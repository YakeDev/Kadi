const appName = process.env.APP_NAME || 'Kadi'
const appUrl = process.env.APP_URL || 'https://kadi.app'

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #1d1d1f;
  background: #f5f5f7;
  padding: 32px 0;
`

const cardStyles = `
  max-width: 520px;
  margin: 0 auto;
  background: rgba(255,255,255,0.95);
  border-radius: 28px;
  padding: 32px;
  box-shadow: 0 30px 80px -40px rgba(28,28,30,0.2);
  border: 1px solid rgba(15,23,42,0.06);
`

const buttonStyles = `
  display: inline-block;
  background: #0a84ff;
  color: #ffffff;
  border-radius: 999px;
  padding: 14px 34px;
  font-weight: 600;
  text-decoration: none;
`

export const emailVerificationTemplate = ({ verificationUrl, companyName }) => ({
  subject: `Confirmez votre email pour ${appName}`,
  html: `
    <div style="${baseStyles}">
      <div style="${cardStyles}">
        <h1 style="font-size: 24px; margin-bottom: 12px;">Bienvenue ${companyName ? `chez ${companyName}` : ''} 👋</h1>
        <p style="margin: 0 0 16px 0; font-size: 16px;">
          Merci d'avoir créé un compte sur <strong>${appName}</strong>. Pour finaliser votre inscription, confirmez votre adresse email.
        </p>
        <p style="margin: 0 0 28px 0;">
          <a href="${verificationUrl}" style="${buttonStyles}">Confirmer mon email</a>
        </p>
        <p style="font-size: 14px; color: #6e6e73;">Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :</p>
        <p style="font-size: 13px; word-break: break-all; color: #6e6e73;">${verificationUrl}</p>
        <hr style="margin: 32px 0; border: none; border-top: 1px solid rgba(15,23,42,0.08);" />
        <p style="font-size: 13px; color: #6e6e73;">
          Cet email vous est adressé car une inscription a été réalisée sur ${appName}. Si ce n'était pas vous, ignorez ce message.
        </p>
        <p style="font-size: 13px; color: #6e6e73;">
          — L'équipe ${appName}
        </p>
      </div>
    </div>
  `,
  text: [
    `Bienvenue chez ${companyName || appName}!`,
    '',
    `Merci d'avoir créé un compte sur ${appName}. Pour finaliser votre inscription, veuillez confirmer votre adresse email :`,
    verificationUrl,
    '',
    `Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.`
  ].join('\n')
})

export const passwordResetTemplate = ({ resetUrl, companyName }) => ({
  subject: `Réinitialisez votre mot de passe ${appName}`,
  html: `
    <div style="${baseStyles}">
      <div style="${cardStyles}">
        <h1 style="font-size: 24px; margin-bottom: 12px;">Bonjour${companyName ? ` ${companyName}` : ''} 👋</h1>
        <p style="margin: 0 0 16px 0; font-size: 16px;">
          Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte <strong>${appName}</strong>.
        </p>
        <p style="margin: 0 0 28px 0;">
          <a href="${resetUrl}" style="${buttonStyles}">Créer un nouveau mot de passe</a>
        </p>
        <p style="font-size: 14px; color: #6e6e73;">
          Si vous n'êtes pas à l'origine de cette demande, aucune action n'est requise.
        </p>
        <hr style="margin: 32px 0; border: none; border-top: 1px solid rgba(15,23,42,0.08);" />
        <p style="font-size: 13px; color: #6e6e73;">
          Lien de secours (copiez-collez dans votre navigateur) :<br />
          <span style="word-break: break-all;">${resetUrl}</span>
        </p>
        <p style="font-size: 13px; color: #6e6e73;">
          — L'équipe ${appName}
        </p>
      </div>
    </div>
  `,
  text: [
    `Bonjour ${companyName || ''}`.trim(),
    '',
    `Nous avons reçu une demande de réinitialisation de mot de passe pour ${appName}.`,
    'Suivez ce lien pour créer un nouveau mot de passe :',
    resetUrl,
    '',
    "Si vous n'avez pas fait cette demande, ignorez simplement ce message."
  ].join('\n')
})
