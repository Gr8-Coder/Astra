export type RecurringItem = {
  amount: number;
  dueDay: string;
  icon: string;
  label: string;
  paid?: boolean;
  type: 'brand' | 'emoji' | 'icon' | 'add';
};

export const recurringSummary = {
  leftToPay: 290,
  paidSoFar: 11249
};

export const recurringItems: RecurringItem[] = [
  {
    amount: 170,
    dueDay: '1st',
    icon: 'spotify',
    label: 'Spotify',
    paid: true,
    type: 'brand'
  },
  {
    amount: 130,
    dueDay: '2nd',
    icon: 'google',
    label: 'Google',
    paid: true,
    type: 'brand'
  },
  {
    amount: 5000,
    dueDay: '3rd',
    icon: '🏠',
    label: 'Rent',
    paid: true,
    type: 'emoji'
  },
  {
    amount: 2500,
    dueDay: '4th',
    icon: '🍚',
    label: 'Tiffin',
    paid: true,
    type: 'emoji'
  },
  {
    amount: 700,
    dueDay: '5th',
    icon: '🥥',
    label: 'Coconut',
    paid: true,
    type: 'emoji'
  },
  {
    amount: 290,
    dueDay: '6th',
    icon: 'N',
    label: 'Netflix',
    type: 'brand'
  },
  {
    amount: 799,
    dueDay: '7th',
    icon: 'hotstar',
    label: 'hotstar',
    paid: true,
    type: 'brand'
  },
  {
    amount: 1200,
    dueDay: '8th',
    icon: 'headphones',
    label: 'Audible',
    type: 'icon'
  },
  {
    amount: 750,
    dueDay: '9th',
    icon: '🎬',
    label: 'Prime',
    paid: true,
    type: 'emoji'
  },
  {
    amount: 0,
    dueDay: '',
    icon: 'add',
    label: '',
    type: 'add'
  }
];
