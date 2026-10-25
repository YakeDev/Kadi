import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { isNativeAndroid } from '../native/platform.js'

const NativeRuntime = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    if (isNativeAndroid() && window.scrollY) window.scrollTo(0, 0)
  }, [pathname])
  useEffect(() => {
    if (!isNativeAndroid()) return
    let disposed = false
    const listeners = []
    const retain = async (listener) => {
      const handle = await listener
      if (disposed) await handle.remove()
      else listeners.push(handle)
    }
    const setup = async () => {
      const [{ App }, { Network }] = await Promise.all([import('@capacitor/app'), import('@capacitor/network')])
      if (disposed) return
      await retain(App.addListener('backButton', ({ canGoBack }) => {
        // Existing modal focus traps and account menus already handle Escape.
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        document.dispatchEvent(escape)
        if (escape.defaultPrevented) return
        if (['/', '/login'].includes(window.location.pathname)) { App.minimizeApp(); return }
        if (canGoBack) window.history.back()
        else navigate('/', { replace: true })
      }))
      await retain(Network.addListener('networkStatusChange', ({ connected }) => { if (!disposed) setOffline(!connected) }))
      const status = await Network.getStatus()
      if (!disposed) setOffline(!status.connected)
    }
    setup().catch(() => { /* Core web features remain usable if a native plugin fails. */ })
    return () => { disposed = true; listeners.forEach(handle => { handle.remove() }) }
  }, [navigate])
  if (!offline) return null
  return <div role='status' className='native-offline'><WifiOff aria-hidden='true' className='h-4 w-4 shrink-0' /><span>Connexion interrompue. Reconnectez-vous pour enregistrer vos modifications.</span></div>
}

export default NativeRuntime
