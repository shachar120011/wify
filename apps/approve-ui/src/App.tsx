import { IdentityApp } from './IdentityApp'
import { MailApp } from './MailApp'
import { ModeNav, modeFromPath } from './ModeNav'
import { WhatsAppApp } from './WhatsAppApp'

export default function App() {
  const mode = modeFromPath(window.location.pathname)

  return (
    <>
      <ModeNav mode={mode} />
      {mode === 'identity' ? (
        <IdentityApp />
      ) : mode === 'whatsapp' ? (
        <WhatsAppApp />
      ) : (
        <MailApp />
      )}
    </>
  )
}
