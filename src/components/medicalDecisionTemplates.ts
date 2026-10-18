// Keep the client editor defaults and API notification defaults aligned.
export type DecisionTemplate = { subject: string; body: string };
export const medicalDecisionDefaults: Record<string, Record<string, DecisionTemplate>> = {
  "medicalReviewNeedsInfoTemplates": {
    "en": {
      "subject": "More information needed for your medical document",
      "body": "Hello {{client.firstName}},\n\nOur medical team needs more information to complete the review of your document: {{document.type}}.\n\nPlease sign in to IbogaReady to check the requested next steps and provide the information or updated document requested there: {{links.clientPortal}}\n\nUse your existing sign-in details. If anything is unclear, please contact our team before submitting an update."
    },
    "cs": {
      "subject": "K vašemu zdravotnímu dokumentu potřebujeme další informace",
      "body": "Dobrý den, {{client.firstName}},\n\nNáš zdravotní tým potřebuje další informace k dokončení kontroly vašeho dokumentu: {{document.type}}.\n\nPřihlaste se prosím do aplikace IbogaReady, zkontrolujte požadované další kroky a poskytněte informace nebo aktualizovaný dokument podle pokynů v aplikaci: {{links.clientPortal}}\n\nPoužijte své stávající přihlašovací údaje. Pokud vám něco není jasné, kontaktujte náš tým před odesláním aktualizace."
    },
    "pl": {
      "subject": "Potrzebujemy dodatkowych informacji dotyczących Twojego dokumentu medycznego",
      "body": "Dzień dobry, {{client.firstName}},\n\nNasz zespół medyczny potrzebuje dodatkowych informacji, aby zakończyć weryfikację Twojego dokumentu: {{document.type}}.\n\nZaloguj się do aplikacji IbogaReady, sprawdź wymagane dalsze kroki i przekaż informacje lub zaktualizowany dokument zgodnie z instrukcjami w aplikacji: {{links.clientPortal}}\n\nUżyj dotychczasowych danych logowania. Jeśli coś jest niejasne, skontaktuj się z naszym zespołem przed przesłaniem aktualizacji."
    }
  },
  "medicalReviewDeclinedTemplates": {
    "en": {
      "subject": "Your medical document was not approved",
      "body": "Hello {{client.firstName}},\n\nOur medical team has reviewed your document: {{document.type}}. This document was not approved.\n\nPlease sign in to IbogaReady to check its status and any available next steps: {{links.clientPortal}}\n\nUse your existing sign-in details. Please contact our team if you need clarification about what to do next."
    },
    "cs": {
      "subject": "Váš zdravotní dokument nebyl schválen",
      "body": "Dobrý den, {{client.firstName}},\n\nNáš zdravotní tým zkontroloval váš dokument: {{document.type}}. Tento dokument nebyl schválen.\n\nPřihlaste se prosím do aplikace IbogaReady a zkontrolujte jeho stav a případné další kroky: {{links.clientPortal}}\n\nPoužijte své stávající přihlašovací údaje. Pokud potřebujete objasnit další postup, kontaktujte prosím náš tým."
    },
    "pl": {
      "subject": "Twój dokument medyczny nie został zatwierdzony",
      "body": "Dzień dobry, {{client.firstName}},\n\nNasz zespół medyczny sprawdził Twój dokument: {{document.type}}. Ten dokument nie został zatwierdzony.\n\nZaloguj się do aplikacji IbogaReady, aby sprawdzić jego status i dostępne dalsze kroki: {{links.clientPortal}}\n\nUżyj dotychczasowych danych logowania. Jeśli potrzebujesz wyjaśnienia dalszego postępowania, skontaktuj się z naszym zespołem."
    }
  }
};

export function resolveDecisionTemplates(key: string, configured?: Record<string, Partial<DecisionTemplate>>): Record<string, DecisionTemplate> {
  return Object.fromEntries(Object.entries(medicalDecisionDefaults[key]).map(([language, defaults]) => [language, { ...defaults, ...(language === "cs" ? configured?.cz : undefined), ...configured?.[language] }]));
}
