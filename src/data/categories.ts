export type CategoryBudgetItem = {
  accent: string;
  budget: number;
  icon: string;
  isGroup?: boolean;
  level?: 0 | 1;
  name: string;
  spent: number;
  tone?: 'green' | 'yellow' | 'orange' | 'red';
};

export const categoriesSummary = {
  spent: 19383,
  totalBudget: 23250
};

export const categoryBudgetItems: CategoryBudgetItem[] = [
  {
    accent: '#DA2017',
    budget: 7500,
    icon: 'key',
    name: 'Rent',
    spent: 6780,
    tone: 'green'
  },
  {
    accent: '#4CD112',
    budget: 4500,
    icon: 'restaurant',
    isGroup: true,
    name: 'Food & Drink',
    spent: 3411,
    tone: 'green'
  },
  {
    accent: '#68D61D',
    budget: 2000,
    icon: 'nutrition',
    level: 1,
    name: 'Groceries',
    spent: 1680,
    tone: 'green'
  },
  {
    accent: '#68D61D',
    budget: 1500,
    icon: 'fast-food',
    level: 1,
    name: 'Restaurant',
    spent: 1100,
    tone: 'yellow'
  },
  {
    accent: '#68D61D',
    budget: 1000,
    icon: 'cafe',
    level: 1,
    name: 'Coffee',
    spent: 631,
    tone: 'green'
  },
  {
    accent: '#20C5C1',
    budget: 1500,
    icon: 'car-sport',
    name: 'Car & Transport',
    spent: 1800,
    tone: 'red'
  },
  {
    accent: '#5A58D8',
    budget: 2000,
    icon: 'bag-handle',
    isGroup: true,
    name: 'Shopping',
    spent: 1499,
    tone: 'green'
  },
  {
    accent: '#735DFF',
    budget: 1000,
    icon: 'shirt',
    level: 1,
    name: 'Clothing',
    spent: 799,
    tone: 'green'
  },
  {
    accent: '#735DFF',
    budget: 1000,
    icon: 'basket',
    level: 1,
    name: 'Shops',
    spent: 700,
    tone: 'green'
  },
  {
    accent: '#E11D1D',
    budget: 500,
    icon: 'boat',
    name: 'Travel & Vacation',
    spent: 283,
    tone: 'green'
  },
  {
    accent: '#E11D1D',
    budget: 200,
    icon: 'film',
    name: 'Entertainment',
    spent: 135,
    tone: 'green'
  },
  {
    accent: '#E11D1D',
    budget: 200,
    icon: 'construct',
    name: 'Utilities',
    spent: 126,
    tone: 'green'
  },
  {
    accent: '#E11D1D',
    budget: 200,
    icon: 'tv',
    name: 'Streaming',
    spent: 128,
    tone: 'green'
  },
  {
    accent: '#E11D1D',
    budget: 200,
    icon: 'medkit',
    name: 'Healthcare',
    spent: 183,
    tone: 'orange'
  },
  {
    accent: '#E11D1D',
    budget: 150,
    icon: 'barbell',
    name: 'Gym',
    spent: 70,
    tone: 'green'
  },
  {
    accent: '#E11D1D',
    budget: 200,
    icon: 'person',
    name: 'Other',
    spent: 58,
    tone: 'green'
  }
];
