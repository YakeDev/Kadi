import { ArrowLeft, ArrowRight, FilePenLine, FileText, Mail, ShieldCheck, Users } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const CONTACT_EMAIL = 'hello@ericaystudio.com'
const UPDATED_AT = '26 octobre 2026'

const informationLinks = [
  { to: '/a-propos', label: 'À propos' },
  { to: '/conditions-utilisation', label: 'Conditions d’utilisation' },
  { to: '/confidentialite', label: 'Confidentialité' }
]

const ContactLink = ({ subject = 'Question concernant Kadi', children = CONTACT_EMAIL }) => (
  <a className='font-medium text-[var(--primary)] underline underline-offset-4' href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`}>
    {children}
  </a>
)

const InformationLayout = ({ eyebrow, title, introduction, children }) => {
  const { session } = useAuth()

  return (
    <div className='min-h-screen bg-[var(--bg-base)] text-[var(--text-dark)]'>
      <header className='border-b border-[var(--border)] bg-white'>
        <div className='mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4 sm:px-8'>
          <Link to={session ? '/' : '/login'} className='flex items-center gap-3 rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]' aria-label='Retour à Kadi'>
            <span className='flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] text-white'><FileText aria-hidden='true' className='h-5 w-5' /></span>
            <span className='text-lg'>Kadi</span>
          </Link>
          <Link to={session ? '/' : '/login'} className='inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--primary)]'>
            <ArrowLeft aria-hidden='true' className='h-4 w-4' /> Retour à l’application
          </Link>
        </div>
      </header>

      <main className='mx-auto max-w-4xl px-5 pb-14 pt-8 sm:px-8 sm:pt-12'>
        <nav aria-label='Informations sur Kadi' className='mb-8 flex flex-wrap gap-2'>
          {informationLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${isActive ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)] bg-white text-[var(--text-muted)] hover:text-[var(--text-dark)]'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className='mb-8'>
          <p className='mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]'>{eyebrow}</p>
          <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>{title}</h1>
          <p className='mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)]'>{introduction}</p>
        </div>
        {children}
      </main>

      <footer className='border-t border-[var(--border)] bg-white'>
        <div className='mx-auto flex max-w-4xl flex-col gap-3 px-5 py-6 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8'>
          <span>Kadi · Ericay Studio · Lubumbashi, RDC</span>
          <ContactLink subject='Question concernant Kadi'>Nous contacter</ContactLink>
        </div>
      </footer>
    </div>
  )
}

const InformationCard = ({ icon: Icon, title, children }) => (
  <div className='rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5 sm:p-6'>
    <Icon aria-hidden='true' className='mb-4 h-6 w-6 text-[var(--primary)]' />
    <h2 className='text-lg font-semibold'>{title}</h2>
    <p className='mt-2 text-sm leading-6 text-[var(--text-muted)]'>{children}</p>
  </div>
)

const PolicySection = ({ title, children, id }) => (
  <section id={id} className='border-b border-[var(--border)] py-6 first:pt-0 last:border-b-0 last:pb-0'>
    <h2 className='text-lg font-semibold'>{title}</h2>
    <div className='mt-3 space-y-3 text-sm leading-7 text-[var(--text-muted)]'>{children}</div>
  </section>
)

export const AboutPage = () => (
  <InformationLayout
    eyebrow='Une facturation plus simple'
    title='À propos de Kadi'
    introduction='Kadi aide les petites entreprises et les indépendants à préparer leurs devis, créer leurs factures et suivre les paiements au même endroit.'>
    <div className='grid gap-4 sm:grid-cols-3'>
      <InformationCard icon={Users} title='Organiser'>Enregistrez vos clients, les informations de votre entreprise et vos articles ou prestations.</InformationCard>
      <InformationCard icon={FilePenLine} title='Créer'>Préparez des devis et des factures en USD ou en CDF, avec votre identité et votre logo, puis exportez vos documents en PDF.</InformationCard>
      <InformationCard icon={ShieldCheck} title='Suivre'>Consultez vos documents et les paiements enregistrés pour voir ce qui reste à recevoir.</InformationCard>
    </div>
    <div className='mt-6 rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5 sm:p-7'>
      <h2 className='text-lg font-semibold'>Comment Kadi fonctionne</h2>
      <p className='mt-3 text-sm leading-7 text-[var(--text-muted)]'>Vous créez un compte pour votre entreprise, ajoutez vos clients et vos prestations, puis préparez vos documents. Une aide facultative par intelligence artificielle peut proposer un brouillon à partir du texte que vous lui confiez ; vous vérifiez toujours le résultat avant de l’utiliser.</p>
      <p className='mt-3 text-sm leading-7 text-[var(--text-muted)]'>Kadi est un outil de gestion. Il ne remplace pas un comptable ou un conseil fiscal : vérifiez les mentions et obligations applicables à votre activité avant d’émettre une facture.</p>
    </div>
    <div className='mt-6 grid gap-4 sm:grid-cols-2'>
      <Link to='/conditions-utilisation' className='group rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5 hover:border-[var(--primary)]'>
        <h2 className='font-semibold'>Conditions d’utilisation</h2>
        <p className='mt-2 text-sm leading-6 text-[var(--text-muted)]'>Les règles d’utilisation de Kadi et vos responsabilités lorsque vous créez des documents.</p>
        <span className='mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]'>Lire les conditions <ArrowRight aria-hidden='true' className='h-4 w-4' /></span>
      </Link>
      <Link to='/confidentialite' className='group rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5 hover:border-[var(--primary)]'>
        <h2 className='font-semibold'>Politique de confidentialité</h2>
        <p className='mt-2 text-sm leading-6 text-[var(--text-muted)]'>Les données utilisées par Kadi, leur finalité et la manière de nous contacter à leur sujet.</p>
        <span className='mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]'>Lire la politique <ArrowRight aria-hidden='true' className='h-4 w-4' /></span>
      </Link>
    </div>
  </InformationLayout>
)

export const TermsPage = () => (
  <InformationLayout
    eyebrow={`Dernière mise à jour : ${UPDATED_AT}`}
    title='Conditions d’utilisation'
    introduction='Ces conditions expliquent à quoi sert Kadi et ce qui relève de la responsabilité de chaque utilisateur.'>
    <article className='rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5 sm:p-8'>
      <PolicySection title='1. Le service'>
        <p>Kadi, proposé par Ericay Studio à Lubumbashi (RDC), permet de gérer des informations d’entreprise et de clients, un catalogue, des devis, des factures et leurs paiements. Certaines fonctions peuvent évoluer pendant la phase pilote.</p>
      </PolicySection>
      <PolicySection title='2. Votre compte et vos accès'>
        <p>Renseignez des informations exactes, protégez vos identifiants et signalez tout accès que vous ne reconnaissez pas. Les actions réalisées avec votre compte peuvent modifier vos documents et vos données.</p>
      </PolicySection>
      <PolicySection title='3. Vos documents et vos obligations'>
        <p>Vous restez responsable des données saisies, des prix, des taxes éventuelles, des mentions obligatoires, du contenu transmis à vos clients et de la conformité de vos documents aux règles qui s’appliquent à votre activité. Vérifiez chaque devis et chaque facture avant de l’envoyer.</p>
      </PolicySection>
      <PolicySection title='4. Données de tiers et usage autorisé'>
        <p>Ne renseignez les coordonnées d’un client ou d’un autre tiers que pour une activité légitime et avec les droits nécessaires. N’utilisez pas Kadi pour créer des documents trompeurs, usurper une identité, perturber le service ou accéder aux données d’une autre entreprise.</p>
      </PolicySection>
      <PolicySection title='5. Aide facultative par IA'>
        <p>Si vous utilisez l’aide par intelligence artificielle, le texte que vous fournissez est transmis pour préparer une proposition de brouillon. Le résultat peut comporter des erreurs : relisez les montants, les dates, les identités et le contenu avant tout enregistrement ou envoi. Évitez d’y saisir des données sensibles qui ne sont pas nécessaires.</p>
      </PolicySection>
      <PolicySection title='6. Disponibilité et évolution'>
        <p>Des opérations de maintenance ou des incidents peuvent interrompre temporairement Kadi. Les fonctions et ces conditions peuvent être ajustées ; la date de mise à jour figure en haut de cette page. Pour toute question relative au service, contactez-nous.</p>
      </PolicySection>
      <PolicySection title='7. Contact'>
        <p>Écrivez à <ContactLink subject='Conditions d’utilisation de Kadi' />. La manière dont vos données sont traitées est décrite dans la <Link to='/confidentialite' className='font-medium text-[var(--primary)] underline underline-offset-4'>politique de confidentialité</Link>.</p>
      </PolicySection>
    </article>
  </InformationLayout>
)

export const PrivacyPage = () => (
  <InformationLayout
    eyebrow={`Dernière mise à jour : ${UPDATED_AT}`}
    title='Politique de confidentialité'
    introduction='Nous expliquons ici quelles données Kadi utilise pour faire fonctionner votre compte et vos documents.'>
    <article className='rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5 sm:p-8'>
      <PolicySection title='1. Qui contacter ?'>
        <p>Kadi est un projet d’Ericay Studio, basé à Lubumbashi, en République démocratique du Congo. Pour une question sur vos données ou une demande relative à votre compte, écrivez à <ContactLink subject='Confidentialité Kadi' />.</p>
      </PolicySection>
      <PolicySection title='2. Données utilisées'>
        <p>Selon votre usage, Kadi traite l’adresse email et les informations de connexion du compte ; les coordonnées, identifiants professionnels et le logo de votre entreprise ; les noms et coordonnées de vos clients ; le contenu des devis et factures, leurs montants, statuts et paiements.</p>
        <p>Les informations techniques nécessaires à la connexion, à la sécurité et au diagnostic des erreurs peuvent également être traitées. Si vous activez l’aide par IA, le texte que vous y saisissez et la réponse générée sont traités pour préparer votre brouillon.</p>
      </PolicySection>
      <PolicySection title='3. Pourquoi ces données ?'>
        <p>Nous les utilisons pour créer et sécuriser les comptes, enregistrer les informations des entreprises et de leurs clients, produire les documents, suivre les paiements, envoyer les emails de confirmation ou de récupération du compte et maintenir le service. L’administration de Kadi peut consulter des statistiques globales d’utilisation, comme le nombre d’entreprises inscrites ou de factures créées.</p>
      </PolicySection>
      <PolicySection title='4. Services qui interviennent'>
        <p>Kadi s’appuie sur Supabase pour l’authentification et le stockage des données et logos, Vercel pour l’application web et Render pour son API. Des emails de service peuvent être envoyés avec Resend ou un service de messagerie configuré par Kadi. Si vous utilisez l’aide par IA, le texte soumis est transmis à OpenAI afin de produire le brouillon demandé.</p>
        <p>Quand vous téléchargez ou partagez un PDF, vous choisissez vous-même son destinataire et le moyen de transmission. Nous ne vendons pas vos données personnelles.</p>
      </PolicySection>
      <PolicySection title='5. Protection et durée de conservation'>
        <p>L’accès aux données métier passe par un compte et des contrôles liés à l’entreprise. Les communications avec les services sont protégées lors de leur transmission. Aucune plateforme ne peut garantir une sécurité absolue ; signalez-nous rapidement tout accès suspect.</p>
        <p>Les données du compte et les documents sont conservés pendant l’utilisation de Kadi. Lorsqu’une suppression est demandée, nous examinons les données à effacer et celles qui doivent éventuellement être conservées pour respecter une obligation applicable, notamment pour certains documents commerciaux. Nous précisons au demandeur ce qui est conservé et pourquoi.</p>
      </PolicySection>
      <PolicySection id='suppression' title='6. Accès, correction et suppression'>
        <p>Vous pouvez modifier certaines informations dans l’application. Pour demander l’accès, la correction ou la suppression de votre compte et des données associées, écrivez à <ContactLink subject='Demande relative à mes données Kadi' /> en précisant l’adresse liée au compte. Nous pourrons vous demander une vérification afin de protéger vos données avant de traiter la demande.</p>
      </PolicySection>
      <PolicySection title='7. Changements'>
        <p>Cette politique sera mise à jour si les fonctions ou les services utilisés par Kadi évoluent. La date affichée en haut de page indique la dernière révision du texte. Pour les règles d’usage de Kadi, consultez les <Link to='/conditions-utilisation' className='font-medium text-[var(--primary)] underline underline-offset-4'>conditions d’utilisation</Link>.</p>
      </PolicySection>
    </article>
    <p className='mt-6 text-sm leading-6 text-[var(--text-muted)]'><Mail aria-hidden='true' className='mr-2 inline h-5 w-5 align-text-bottom text-[var(--primary)]' /> Une question sur la confidentialité ? <ContactLink subject='Question sur la confidentialité Kadi'>Écrivez-nous</ContactLink>.</p>
  </InformationLayout>
)
