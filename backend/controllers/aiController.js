import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const generateInvoiceFromText = async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ message: 'OPENAI_API_KEY manquant.' })
    }

    const { texte } = req.body
    if (!texte) {
      return res.status(400).json({ message: 'Le champ texte est requis.' })
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: 'Tu es un assistant qui crée des factures JSON.' },
        {
          role: 'user',
          content: `Analyse ce texte et renvoie une facture JSON : ${texte}`
        }
      ],
      response_format: { type: 'json_object' }
    })

    const payload = JSON.parse(response.choices[0].message.content)
    res.json(payload)
  } catch (error) {
    next(error)
  }
}
