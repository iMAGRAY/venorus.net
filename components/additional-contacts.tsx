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

export function AdditionalContacts({ contacts, className = '', theme = 'light' }: AdditionalContactsProps) {
  return (
    <div className={className}>
      {contacts.map((contact, index) => (
        <div key={index} className="contact-item">
          <span>{contact.label || contact.type}: {contact.value}</span>
        </div>
      ))}
    </div>
  );
}

export default AdditionalContacts;
