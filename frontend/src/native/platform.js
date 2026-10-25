import { Capacitor } from '@capacitor/core'

export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

export const configureNativeDocument = () => {
  if (isNativeAndroid()) document.documentElement.dataset.nativePlatform = 'android'
}
