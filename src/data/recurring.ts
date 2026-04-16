export type RecurringItem = {
  amount: number;
  categoryLabel?: string;
  dueDay: string;
  id: string;
  icon: string;
  label: string;
  paid?: boolean;
  type: 'brand' | 'emoji' | 'icon' | 'add';
};

export const recurringSummary = {
  leftToPay: 11539,
  paidSoFar: 0
};

export const recurringItems: RecurringItem[] = [
  {
    amount: 170,
    categoryLabel: 'Streaming',
    dueDay: '1st',
    id: 'spotify-1st',
    icon: 'spotify',
    label: 'Spotify',
    type: 'brand'
  },
  {
    amount: 130,
    categoryLabel: 'Utilities',
    dueDay: '2nd',
    id: 'google-2nd',
    icon: 'google',
    label: 'Google',
    type: 'brand'
  },
  {
    amount: 5000,
    categoryLabel: 'Rent',
    dueDay: '3rd',
    id: 'rent-3rd',
    icon: '🏠',
    label: 'Rent',
    type: 'emoji'
  },
  {
    amount: 2500,
    categoryLabel: 'Food & Drink',
    dueDay: '4th',
    id: 'tiffin-4th',
    icon: '🍚',
    label: 'Tiffin',
    type: 'emoji'
  },
  {
    amount: 700,
    categoryLabel: 'Food & Drink',
    dueDay: '5th',
    id: 'coconut-5th',
    icon: '🥥',
    label: 'Coconut',
    type: 'emoji'
  },
  {
    amount: 290,
    categoryLabel: 'Streaming',
    dueDay: '6th',
    id: 'netflix-6th',
    icon: 'N',
    label: 'Netflix',
    type: 'brand'
  },
  {
    amount: 799,
    categoryLabel: 'Streaming',
    dueDay: '7th',
    id: 'hotstar-7th',
    icon: 'hotstar',
    label: 'hotstar',
    type: 'brand'
  },
  {
    amount: 1200,
    categoryLabel: 'Streaming',
    dueDay: '8th',
    id: 'audible-8th',
    icon: 'headphones',
    label: 'Audible',
    type: 'icon'
  },
  {
    amount: 750,
    categoryLabel: 'Streaming',
    dueDay: '9th',
    id: 'prime-9th',
    icon: '🎬',
    label: 'Prime',
    type: 'emoji'
  },
  {
    amount: 0,
    dueDay: '',
    id: 'add-card',
    icon: 'add',
    label: '',
    type: 'add'
  }
];
