import dotenv from 'dotenv'
import app from './app.js'

dotenv.config()

const PORT = process.env.PORT || 4000

const server = app.listen(PORT, () => {
  console.log(`✅ KADI backend actif sur le port ${PORT}`)
})

export default server
export { app }
