import PDFDocument from 'pdfkit'
import dayjs from 'dayjs'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { supabase } from '../models/supabaseClient.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const computeTotals = (items = []) =>
	items.reduce(
		(acc, item) => {
			const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0)
			acc.subtotal += lineTotal
			return acc
		},
		{ subtotal: 0 }
	)

export const listInvoices = async (req, res, next) => {
	try {
		const tenantId = req.tenantId
		const { data, error } = await supabase
			.from('invoices')
			.select('*, client:clients(*)')
			.eq('tenant_id', tenantId)
			.order('issue_date', { ascending: false })

		if (error) throw error
		res.json(data)
	} catch (error) {
		next(error)
	}
}

export const getInvoice = async (req, res, next) => {
	try {
		const { id } = req.params
		const tenantId = req.tenantId
		const { data, error } = await supabase
			.from('invoices')
			.select('*, client:clients(*)')
			.eq('id', id)
			.eq('tenant_id', tenantId)
			.maybeSingle()
		if (error) throw error
		if (!data) {
			return res.status(404).json({ message: 'Facture introuvable.' })
		}
		res.json(data)
	} catch (error) {
		next(error)
	}
}

export const createInvoice = async (req, res, next) => {
	try {
		const tenantId = req.tenantId
		const payload = req.body
		const items = payload.items || []
		const totals = computeTotals(items)
		const invoiceNumber = `FAC-${Date.now().toString().slice(-6)}`

		if (payload.client_id) {
			const { error: clientError } = await supabase
				.from('clients')
				.select('id')
				.eq('id', payload.client_id)
				.eq('tenant_id', tenantId)
				.single()
			if (clientError) {
				clientError.status = 400
				clientError.message = 'Client introuvable pour ce compte.'
				throw clientError
			}
		}

		const { data, error } = await supabase
			.from('invoices')
			.insert({
				client_id: payload.client_id,
				invoice_number: invoiceNumber,
				issue_date: payload.issue_date,
				due_date: payload.due_date,
				status: payload.status || 'draft',
				notes: payload.notes,
				items,
				subtotal_amount: totals.subtotal,
				total_amount: totals.subtotal,
				currency: payload.currency || '$',
				tenant_id: tenantId,
			})
			.select('*, client:clients(*)')
			.single()

		if (error) throw error
		res.status(201).json(data)
	} catch (error) {
		next(error)
	}
}

export const updateInvoice = async (req, res, next) => {
	try {
		const { id } = req.params
		const tenantId = req.tenantId
		let updates = { ...req.body }

		if (updates.client_id) {
			const { error: clientError } = await supabase
				.from('clients')
				.select('id')
				.eq('id', updates.client_id)
				.eq('tenant_id', tenantId)
				.single()
			if (clientError) {
				clientError.status = 400
				clientError.message = 'Client introuvable pour ce compte.'
				throw clientError
			}
		}

		if (updates.items) {
			const totals = computeTotals(updates.items)
			updates = {
				...updates,
				subtotal_amount: totals.subtotal,
				total_amount: totals.subtotal,
			}
		}

		const { data, error } = await supabase
			.from('invoices')
			.update(updates)
			.eq('id', id)
			.eq('tenant_id', tenantId)
			.select('*, client:clients(*)')
			.single()

		if (error) throw error
		res.json(data)
	} catch (error) {
		next(error)
	}
}

export const deleteInvoice = async (req, res, next) => {
	try {
		const { id } = req.params
		const tenantId = req.tenantId
		const { error } = await supabase
			.from('invoices')
			.delete()
			.eq('id', id)
			.eq('tenant_id', tenantId)
		if (error) throw error
		res.status(204).send()
	} catch (error) {
		next(error)
	}
}

export const getSummary = async (req, res, next) => {
	try {
		const tenantId = req.tenantId
		const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD')
		const { data: monthly, error: monthlyError } = await supabase
			.from('invoices')
			.select('total_amount')
			.gte('issue_date', startOfMonth)
			.eq('status', 'paid')
			.eq('tenant_id', tenantId)

		if (monthlyError) throw monthlyError

		const { data: outstanding, error: outstandingError } = await supabase
			.from('invoices')
			.select('total_amount, status')
			.eq('tenant_id', tenantId)

		if (outstandingError) throw outstandingError

		const summary = {
			monthlyRevenue: monthly.reduce(
				(sum, inv) => sum + Number(inv.total_amount || 0),
				0
			),
			outstanding: outstanding
				.filter((inv) => inv.status === 'overdue' || inv.status === 'sent')
				.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
			paid: outstanding.filter((inv) => inv.status === 'paid').length,
		}

		res.json(summary)
	} catch (error) {
		next(error)
	}
}

export const streamInvoicePdf = async (req, res, next) => {
	try {
		const { id } = req.params
		const tenantId = req.tenantId
		const { data: invoice, error } = await supabase
			.from('invoices')
			.select(`*, client:clients(*)`)
			.eq('id', id)
			.eq('tenant_id', tenantId)
			.maybeSingle()

		if (error) throw error
		if (!invoice)
			return res.status(404).json({ message: 'Facture introuvable.' })

		const doc = new PDFDocument({ margin: 48 })

		res.setHeader('Content-Type', 'application/pdf')
		res.setHeader(
			'Content-Disposition',
			`attachment; filename=facture-${invoice.invoice_number}.pdf`
		)

		doc.pipe(res)

		// === Fonts ===
		const fontsDir = path.resolve(__dirname, '../assets/fonts')
		let regularFont = 'Helvetica'
		let semiBoldFont = 'Helvetica-Bold'
		try {
			const interRegularPath = path.join(fontsDir, 'Inter-Regular.ttf')
			const interSemiBoldPath = path.join(fontsDir, 'Inter-SemiBold.ttf')
			if (fs.existsSync(interRegularPath) && fs.existsSync(interSemiBoldPath)) {
				doc.registerFont('Inter', interRegularPath)
				doc.registerFont('Inter-SemiBold', interSemiBoldPath)
				regularFont = 'Inter'
				semiBoldFont = 'Inter-SemiBold'
			}
		} catch {
			console.warn('Police Inter introuvable, Helvetica utilisée par défaut.')
		}

		// === Couleurs ===
		const baseColor = '#0f172a'
		const accentColor = '#f97316'
		const greyMedium = '#475569'
		const greyLight = '#e2e8f0'
		// const textMuted = '#64748b'
		const bgSoft = '#f9fafb'
		const bgTotals = '#f8fafc'

		const pageWidth =
			doc.page.width - doc.page.margins.left - doc.page.margins.right
		const startX = doc.page.margins.left

		const formatMoney = (v) =>
			`${Number(v || 0).toFixed(2)} ${invoice.currency || 'USD'}`

		// === HEADER ===
		const companyName = req.profile?.company || 'Kadi'
		const companyTagline = req.profile?.tagline || 'Facturation simple pour PME'

		doc
			.font(semiBoldFont)
			.fontSize(26)
			.fillColor(baseColor)
			.text(companyName, startX, 50, { width: pageWidth / 2 })
		if (companyTagline) {
			doc
				.font(regularFont)
				.fontSize(11)
				.fillColor(greyMedium)
				.text(companyTagline, startX, 78, { width: pageWidth / 2 })
		}

		const headerRightX = startX + pageWidth / 2
		doc
			.font(regularFont)
			.fontSize(11)
			.fillColor(greyMedium)
			.text(
				`Émise le ${dayjs(invoice.issue_date).format('DD MMM YYYY')}`,
				headerRightX,
				50,
				{ align: 'right', width: pageWidth / 2 }
			)
			.font(semiBoldFont)
			.fillColor(accentColor)
			.text(`Facture ${invoice.invoice_number}`, headerRightX, 66, {
				align: 'right',
				width: pageWidth / 2,
			})

		doc
			.moveTo(startX, 100)
			.lineTo(startX + pageWidth, 100)
			.stroke(greyLight)

		// === CLIENT BLOCK ===
		const clientBlockY = 120
		const paddingY = 20
		const lineSpacing = 16

		const client = invoice.client || {}

		// Simule les lignes de texte pour mesurer la hauteur
		const clientLines = [
			'Facturé à :',
			client.company_name,
			client.contact_name,
			client.email,
			client.phone,
			client.address,
		].filter(Boolean)

		// Calcule la hauteur totale du contenu
		const contentHeight = paddingY * 2 + clientLines.length * lineSpacing
		const clientBlockHeight = Math.max(80, contentHeight) // 80 = hauteur min visuelle

		// === DESSIN DU CADRE ===
		doc.save()
		doc
			.roundedRect(startX, clientBlockY, pageWidth, clientBlockHeight, 10)
			.fill(bgSoft)
		doc.restore()

		// === TEXTE ===
		let textY = clientBlockY + paddingY
		doc
			.font(semiBoldFont)
			.fontSize(12)
			.fillColor(greyMedium)
			.text('Facturé à :', startX + 20, textY)

		textY += lineSpacing

		doc
			.font(semiBoldFont)
			.fontSize(12)
			.fillColor(baseColor)
			.text(client.company_name || '-', startX + 20, textY)

		textY += lineSpacing

		doc.font(regularFont).fontSize(11).fillColor(baseColor)
		;[client.contact_name, client.email, client.phone, client.address]
			.filter(Boolean)
			.forEach((line) => {
				textY += 14
				doc.text(line, startX + 20, textY, { width: pageWidth - 40 })
			})

		// Après le bloc, tu peux récupérer la position suivante proprement :
		// const nextY = clientBlockY + clientBlockHeight + 20

		// === TABLE ===
		doc.moveDown(3)
		const yTable = clientBlockY + clientBlockHeight + 36

		// Répartition fluide
		const cols = {
			desc: startX,
			qty: startX + 250,
			unit: startX + 300,
			total: startX + 410,
		}

		doc.font(semiBoldFont).fontSize(11).fillColor(greyMedium)
		doc.text('Description', cols.desc, yTable)
		doc.text('Quantité', cols.qty, yTable, { width: 50, align: 'center' })
		doc.text('Prix unitaire', cols.unit, yTable, { width: 100, align: 'right' })
		doc.text('Total', cols.total, yTable, { width: 100, align: 'right' })

		doc
			.moveTo(startX, yTable + 18)
			.lineTo(startX + pageWidth, yTable + 18)
			.stroke(greyLight)

		let y = yTable + 30
		doc.font(regularFont).fontSize(11).fillColor(baseColor)
		;(invoice.items || []).forEach((item) => {
			const qty = Number(item.quantity || 0)
			const unitPrice = Number(item.unitPrice || 0)
			const lineTotal = qty * unitPrice

			// Calcule la hauteur nécessaire pour la description
			const descWidth = cols.qty - cols.desc - 12
			const descHeight = doc.heightOfString(item.description || '-', {
				width: descWidth,
			})
			const rowHeight = Math.max(descHeight, 22) // hauteur uniforme

			// --- Colonne Description ---
			doc.text(item.description || '-', cols.desc, y, {
				width: descWidth,
				lineBreak: true,
			})

			// --- Colonne Quantité ---
			doc.text(String(qty || '-'), cols.qty, y, {
				width: 50,
				align: 'center',
				lineBreak: false,
			})

			// --- Colonne Prix unitaire ---
			const unitText = `${unitPrice.toFixed(2)}\u00A0${invoice.currency}`
			doc.text(unitText, cols.unit, y, {
				width: 100,
				align: 'right',
				lineBreak: false,
			})

			// --- Colonne Total ---
			const totalText = `${lineTotal.toFixed(2)}\u00A0${invoice.currency}`
			doc.text(totalText, cols.total, y, {
				width: 100,
				align: 'right',
				lineBreak: false,
			})

			// --- Ligne de séparation ---
			y += rowHeight + 6
			doc
				.moveTo(startX, y)
				.lineTo(startX + pageWidth, y)
				.stroke('#f1f5f9')
		})

		// === TOTALS ===
		y += 20
		const totalsWidth = 220
		const totalsX = startX + pageWidth - totalsWidth
		const totalsY = y

		doc.save().roundedRect(totalsX, totalsY, totalsWidth, 70, 10).fill(bgTotals)
		doc.restore()

		// Libellé
		doc
			.font(regularFont)
			.fontSize(11)
			.fillColor(greyMedium)
			.text('Sous-total', totalsX + 18, totalsY + 14, {
				align: 'right',
				width: totalsWidth - 36, // marge interne gauche + droite
			})

		// Montant
		doc
			.font(semiBoldFont)
			.fontSize(14)
			.fillColor(baseColor)
			.text(formatMoney(invoice.total_amount), totalsX + 18, totalsY + 30, {
				align: 'right',
				width: totalsWidth - 36,
			})

		// doc
		// 	.font(regularFont)
		// 	.fontSize(10)
		// 	.fillColor(accentColor)
		// 	.text('Merci pour votre confiance.', totalsX + 18, totalsY + 52)

		// === PAYMENT TERMS ===
		// doc.moveDown(3)
		// doc
		// 	.font(semiBoldFont)
		// 	.fontSize(12)
		// 	.fillColor(greyMedium)
		// 	.text('Conditions de paiement')
		// doc
		// 	.font(regularFont)
		// 	.fontSize(10.5)
		// 	.fillColor(textMuted)
		// 	.text(
		// 		'Un acompte de 30 % du montant total est exigé avant le début du projet. Le solde de 70 % sera réglé à la livraison finale, après validation des livrables convenus.',
		// 		{
		// 			width: pageWidth * 0.85,
		// 			lineGap: 3,
		// 		}
		// 	)

		if (invoice.notes) {
			doc.moveDown(2)
			doc
				.font(semiBoldFont)
				.fontSize(12)
				.fillColor(greyMedium)
				.text('Notes', startX, doc.y, { align: 'left' })

			doc
				.font(regularFont)
				.fontSize(10.5)
				.fillColor(baseColor)
				.text(invoice.notes, startX, doc.y + 6, {
					width: pageWidth * 0.9,
					align: 'left', // force l'alignement à gauche
				})
		}

		// === FOOTER ===
		const footerY = doc.page.height - doc.page.margins.bottom - 22
		doc
			.moveTo(startX, footerY)
			.lineTo(startX + pageWidth, footerY)
			.stroke(greyLight)
		doc
			.font(regularFont)
			.fontSize(9.5)
			.fillColor('#94a3b8')
			.text(`Généré automatiquement par ${companyName}`, startX, footerY + 10, {
				width: pageWidth,
				align: 'center',
			})

		doc.end()
	} catch (error) {
		next(error)
	}
}
