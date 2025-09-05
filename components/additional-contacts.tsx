

interface Contact {
  type: string;
  value: string;
  label?: string;
}

interface AdditionalContactsProps {
  contacts: Contact[];
  className?: string;
  theme?: 'light' | 'dark';
}

// Comprehensive Russian to Spanish translation mapping
const contactTypeTranslations: Record<string, string> = {
  // English/Standard types
  phone: "Teléfono",
  email: "Email", 
  address: "Dirección",
  website: "Sitio web",
  other: "Otro",
  
  // Russian variations - exact matches
  "Доп телефон": "Teléfono adicional",
  "Доп. телефон": "Teléfono adicional", 
  "Доп.телефон": "Teléfono adicional",
  "доп телефон": "Teléfono adicional",
  "доп. телефон": "Teléfono adicional",
  "доп.телефон": "Teléfono adicional",
  "ДОП ТЕЛЕФОН": "Teléfono adicional",
  "ДОП. ТЕЛЕФОН": "Teléfono adicional",
  "ДОП.ТЕЛЕФОН": "Teléfono adicional",
  
  // Additional phone variations
  "Дополнительный телефон": "Teléfono adicional",
  "дополнительный телефон": "Teléfono adicional",
  "ДОПОЛНИТЕЛЬНЫЙ ТЕЛЕФОН": "Teléfono adicional",
  
  // Regular phone variations
  "Телефон": "Teléfono",
  "телефон": "Teléfono", 
  "ТЕЛЕФОН": "Teléfono",
  
  // Address variations
  "Адрес": "Dirección",
  "адрес": "Dirección",
  "АДРЕС": "Dirección",
  
  // Website variations
  "Веб-сайт": "Sitio web",
  "веб-сайт": "Sitio web",
  "ВЕБ-САЙТ": "Sitio web",
  "Сайт": "Sitio web",
  "сайт": "Sitio web",
  "САЙТ": "Sitio web",
  
  // Other variations
  "Другое": "Otro",
  "другое": "Otro",
  "ДРУГОЕ": "Otro"
}

// Function to translate Russian text to Spanish
function translateRussianLabel(label: string): string {
  // Try exact match first
  if (contactTypeTranslations[label]) {
    return contactTypeTranslations[label]
  }
  
  // Try case-insensitive match
  const normalizedLabel = label.toLowerCase().trim()
  const exactMatch = Object.keys(contactTypeTranslations).find(key => 
    key.toLowerCase().trim() === normalizedLabel
  )
  if (exactMatch) {
    return contactTypeTranslations[exactMatch]
  }
  
  // Pattern matching for partial matches
  if (normalizedLabel.includes('доп') && normalizedLabel.includes('телефон')) {
    return "Teléfono adicional"
  }
  if (normalizedLabel.includes('дополнительный') && normalizedLabel.includes('телефон')) {
    return "Teléfono adicional"
  }
  if (normalizedLabel.includes('телефон')) {
    return "Teléfono"
  }
  if (normalizedLabel.includes('адрес')) {
    return "Dirección"
  }
  if (normalizedLabel.includes('email') || normalizedLabel.includes('почта')) {
    return "Email"
  }
  if (normalizedLabel.includes('сайт') || normalizedLabel.includes('веб')) {
    return "Sitio web"
  }
  
  // Return original if no translation found
  return label
}

export function AdditionalContacts({ contacts, className = '', theme: _theme = 'light' }: AdditionalContactsProps) {
  return (
    <div className={className}>
      {contacts.map((contact, index) => {
        // Get the original label or type
        const originalLabel = contact.label || contact.type
        
        // Translate Russian labels to Spanish
        const displayLabel = translateRussianLabel(originalLabel)
        
        return (
          <div key={index} className="contact-item">
            <span>{displayLabel}: {contact.value}</span>
          </div>
        )
      })}
    </div>
  );
}

export default AdditionalContacts;
