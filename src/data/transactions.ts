export type TransactionItem = {
  amount: number;
  amountLabel?: string;
  category: string;
  categoryIcon: string;
  merchant: string;
  pillColor: string;
};

export type TransactionGroup = {
  label: string;
  tone?: 'muted' | 'today';
  transactions: TransactionItem[];
};

export const transactionGroups: TransactionGroup[] = [
  {
    label: 'Today',
    tone: 'today',
    transactions: [
      {
        amount: 87,
        category: 'Groceries',
        categoryIcon: '🥑',
        merchant: 'Blinkit',
        pillColor: '#59BE49'
      },
      {
        amount: 196,
        category: 'Healthcare',
        categoryIcon: '💊',
        merchant: 'Apollo Medical',
        pillColor: '#A32A63'
      },
      {
        amount: 899,
        category: 'Clothing',
        categoryIcon: '👕',
        merchant: 'H&M',
        pillColor: '#326BC5'
      }
    ]
  },
  {
    label: 'FRI, MARCH 15',
    tone: 'muted',
    transactions: [
      {
        amount: 278,
        category: 'Travel',
        categoryIcon: '🚕',
        merchant: 'Uber',
        pillColor: '#4820D0'
      },
      {
        amount: 146.93,
        amountLabel: '₹ 146.93',
        category: 'Restaurant',
        categoryIcon: '🍔',
        merchant: '🌮🌮 to Taco Bell',
        pillColor: '#58B949'
      }
    ]
  },
  {
    label: 'THR, MARCH 14',
    tone: 'muted',
    transactions: [
      {
        amount: 244.6,
        amountLabel: '₹ 244.6',
        category: 'Coffee',
        categoryIcon: '☕',
        merchant: 'Keventers',
        pillColor: '#54B647'
      },
      {
        amount: 132.89,
        amountLabel: '₹ 132.89',
        category: 'Travel',
        categoryIcon: '🚕',
        merchant: 'OLA',
        pillColor: '#4820D0'
      }
    ]
  },
  {
    label: 'WED, MARCH 13',
    tone: 'muted',
    transactions: [
      {
        amount: 169,
        category: 'Restaurant',
        categoryIcon: '🥑',
        merchant: 'Swiggy',
        pillColor: '#58B949'
      },
      {
        amount: 467.77,
        amountLabel: '₹ 467.77',
        category: 'Travel & Vacation',
        categoryIcon: '🏖️',
        merchant: 'Airbnb',
        pillColor: '#A92A9F'
      },
      {
        amount: 370,
        category: 'Shop',
        categoryIcon: '🛍️',
        merchant: 'Crosswords',
        pillColor: '#326BC5'
      },
      {
        amount: 140.2,
        amountLabel: '₹ 140.20',
        category: 'Coffee',
        categoryIcon: '☕',
        merchant: 'Chaayos',
        pillColor: '#54B647'
      }
    ]
  },
  {
    label: 'TUE, MARCH 12',
    tone: 'muted',
    transactions: [
      {
        amount: 140.2,
        amountLabel: '₹ 140.20',
        category: 'Restaurant',
        categoryIcon: '🍔',
        merchant: 'Chaayos',
        pillColor: '#58B949'
      },
      {
        amount: 278,
        category: 'Travel',
        categoryIcon: '🚕',
        merchant: 'Uber',
        pillColor: '#4820D0'
      }
    ]
  }
];
