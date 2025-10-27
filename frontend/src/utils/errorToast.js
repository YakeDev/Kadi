const DEFAULT_MESSAGE = 'Une erreur est survenue. Veuillez réessayer.'

const USER_FRIENDLY_RULES = [
  { test: (msg) => /sku/i.test(msg), message: 'Ce SKU est déjà utilisé. Choisissez un autre identifiant.' },
  {
    test: (msg) => /duplicate|already exist|conflict/i.test(msg),
    message: 'Cette valeur est déjà enregistrée.'
  },
  {
    test: (msg) => /network error|failed to fetch/i.test(msg),
    message: 'Connexion impossible. Vérifiez votre réseau et réessayez.'
  },
  {
    test: (msg) => /timeout/i.test(msg),
    message: 'Le serveur met plus de temps que prévu. Réessayez dans quelques secondes.'
  }
]

const extractMessage = (error) => {
  if (!error) return ''
  if (typeof error === 'string') return error

  if (error.response?.data?.message) {
    return error.response.data.message
  }

  if (error.message) {
    return error.message
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors[0]
  }

  return ''
}

export const getUserFriendlyMessage = (error) => {
  const rawMessage = extractMessage(error)
  if (!rawMessage) return DEFAULT_MESSAGE

  for (const rule of USER_FRIENDLY_RULES) {
    if (rule.test(rawMessage)) {
      return rule.message
    }
  }

  return rawMessage
}

export const showErrorToast = (toastFn, error, options = {}) => {
  const message = getUserFriendlyMessage(error)
  toastFn(message, { icon: options.icon ?? '⚠️', ...options })
}
