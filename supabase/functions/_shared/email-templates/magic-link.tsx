/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Crestwell Travel Services login code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            src="https://zbtnulzvwreqzbmxulpv.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1"
            alt="Crestwell Travel Services"
            width="180"
            style={{ margin: '0 auto' }}
          />
        </Section>
        <Heading style={h1}>Sign in to your account</Heading>
        <Text style={text}>
          Use the code below to sign in to Crestwell Travel Services. It will expire shortly.
        </Text>
        {token ? (
          <Section style={codeSection}>
            <Text style={code}>{token}</Text>
          </Section>
        ) : null}
        <Text style={text}>
          Or, if you prefer, click the button below to sign in automatically.
        </Text>
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>
            Sign In
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '40px 30px', maxWidth: '520px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0f2b52',
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#4c5562',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#173b75',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const hr = { borderColor: '#e5e7eb', margin: '32px 0 20px' }
const codeSection = { textAlign: 'center' as const, margin: '24px 0', backgroundColor: '#f1f5f9', borderRadius: '12px', padding: '20px 0' }
const code = {
  fontSize: '32px',
  fontWeight: '700' as const,
  letterSpacing: '6px',
  color: '#0f2b52',
  margin: '0',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '0' }
