import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PlatformAdmin from '../pages/PlatformAdmin.jsx'
const mocks=vi.hoisted(()=>({get:vi.fn(),access:{isSuperAdmin:true,platformAccessStatus:'ready',refreshPlatformAccess:vi.fn()}}))
vi.mock('../services/api.js',()=>({api:{get:mocks.get}}))
vi.mock('../hooks/useAuth.jsx',()=>({useAuth:()=>mocks.access}))
const overview=()=>({range:{from:'2026-01-01',to:'2026-01-03',time_zone:'Africa/Lubumbashi'},totals:{companies:7,users:8,invoices:23,quotes:4},
 period:{companies_registered:2,users_registered:3,invoices_created:5,invoices_issued:2,quotes_created:3,quotes_converted:1,users_active:2,companies_active:1,receipts_recorded:2},
 daily:[{date:'2026-01-01',invoices_created:0,invoices_issued:0},{date:'2026-01-02',invoices_created:5,invoices_issued:2},{date:'2026-01-03',invoices_created:0,invoices_issued:0}],
 invoice_statuses:{draft:2,sent:10,paid:8,partially_paid:3},activity_tracking_started_at:'2026-01-01T08:00:00Z',historical_issued_without_timestamp:20})
beforeEach(()=>{mocks.get.mockReset().mockImplementation(path=>Promise.resolve({data:path==='/platform/deletion-requests'?{requests:[]}:overview()}));mocks.access.isSuperAdmin=true;mocks.access.platformAccessStatus='ready';mocks.access.refreshPlatformAccess.mockReset()})
const show=()=>render(<MemoryRouter><PlatformAdmin /></MemoryRouter>)
test('ordinary accounts cannot fetch or display global statistics',()=>{
 mocks.access.isSuperAdmin=false;show()
 expect(screen.getByRole('heading',{name:'Accès réservé'})).toBeInTheDocument()
 expect(mocks.get).not.toHaveBeenCalled()
 expect(screen.queryByRole('region',{name:'Entreprises inscrites'})).not.toBeInTheDocument()
})
test('global totals, separate creation/issuance and honest historical coverage are displayed',async()=>{
 show()
 expect(await screen.findByRole('region',{name:'Entreprises inscrites'})).toHaveTextContent('7')
 expect(screen.getByRole('region',{name:'Factures créées'})).toHaveTextContent('5')
 expect(screen.getByRole('region',{name:'Factures émises'})).toHaveTextContent('2')
 expect(screen.getByText(/20 facture\(s\) historique\(s\)/)).toBeInTheDocument()
 expect(screen.getByText(/Suivi de l’activité depuis le 01\/01\/2026/)).toBeInTheDocument()
 fireEvent.click(screen.getByText('Voir le détail par jour'))
 expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4)
 const chart=screen.getByRole('img',{name:/Factures créées par jour/})
 expect(chart.querySelector('path').getAttribute('d')).not.toMatch(/NaN|Infinity/)
})
test('custom inclusive dates are submitted together and change the requested period',async()=>{
 show();await screen.findByRole('region',{name:'Entreprises inscrites'})
 fireEvent.change(screen.getByLabelText('Du'),{target:{value:'2026-01-01'}})
 fireEvent.change(screen.getByLabelText('Au inclus'),{target:{value:'2026-01-03'}})
 fireEvent.click(screen.getByRole('button',{name:'Appliquer'}))
 await waitFor(()=>expect(mocks.get).toHaveBeenLastCalledWith('/platform/overview',expect.objectContaining({params:{from:'2026-01-01',to:'2026-01-03'}})))
})
test('an API denial clears the previous statistics, and retry can recover',async()=>{
 show();await screen.findByRole('region',{name:'Entreprises inscrites'})
 mocks.get.mockRejectedValueOnce({response:{status:403,data:{message:'Accès réservé au Super administrateur.'}}})
 fireEvent.click(screen.getByRole('button',{name:'Actualiser'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Accès réservé')
 expect(screen.queryByRole('region',{name:'Entreprises inscrites'})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Réessayer'}))
 expect(await screen.findByRole('region',{name:'Entreprises inscrites'})).toHaveTextContent('7')
})
