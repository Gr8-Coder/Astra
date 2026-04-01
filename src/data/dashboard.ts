export type ReviewItem = {
  merchant: string;
  merchantIcon: string;
  category: string;
  categoryIcon: string;
  amount: number;
  pillColor: string;
};

export type CategoryBudget = {
  name: string;
  icon: string;
  usedRatio: number;
  amount: number;
  status: string;
  color: string;
};

export type UpcomingPayment = {
  service: string;
  icon: string;
  amount: number;
  dueIn: string;
  accent: string;
};

export type IncomeItem = {
  source: string;
  amount: number;
  accent: string;
  icon: string;
};

export const budgetSummary = {
  left: 1357,
  totalBudget: 5490,
  underAmount: 180
};

export const reviewItems: ReviewItem[] = [
  {
    merchant: 'Uber',
    merchantIcon: 'car-sport',
    category: 'Travel',
    categoryIcon: 'airplane',
    amount: 278,
    pillColor: '#4B2BD1'
  },
  {
    merchant: 'To Taco Bell',
    merchantIcon: 'fast-food',
    category: 'Restaurant',
    categoryIcon: 'restaurant',
    amount: 194,
    pillColor: '#57BE4B'
  }
];

export const categoryBudgets: CategoryBudget[] = [
  {
    name: 'Travel',
    icon: 'car-sport',
    usedRatio: 0.96,
    amount: 271,
    status: 'over',
    color: '#FF3B3B'
  },
  {
    name: 'Food',
    icon: 'nutrition',
    usedRatio: 0.74,
    amount: 76,
    status: 'left',
    color: '#EADB58'
  },
  {
    name: 'Clothing',
    icon: 'shirt',
    usedRatio: 0.66,
    amount: 189,
    status: 'left',
    color: '#9BE54F'
  },
  {
    name: 'Cafes',
    icon: 'cafe',
    usedRatio: 0.58,
    amount: 286,
    status: 'left',
    color: '#4BC56E'
  },
  {
    name: 'Health',
    icon: 'medkit',
    usedRatio: 0.52,
    amount: 154,
    status: 'left',
    color: '#66B8FF'
  },
  {
    name: 'Streaming',
    icon: 'tv',
    usedRatio: 0.44,
    amount: 92,
    status: 'left',
    color: '#B36CFF'
  },
  {
    name: 'Home',
    icon: 'home',
    usedRatio: 0.61,
    amount: 318,
    status: 'left',
    color: '#45CFA0'
  }
];

export const upcomingPayments: UpcomingPayment[] = [
  {
    service: 'Netflix',
    icon: 'film',
    amount: 199,
    dueIn: 'tomorrow',
    accent: '#E74C5E'
  },
  {
    service: 'Spotify',
    icon: 'musical-notes',
    amount: 179,
    dueIn: 'in 8 days',
    accent: '#47CF73'
  },
  {
    service: 'YT Music',
    icon: 'logo-youtube',
    amount: 129,
    dueIn: 'in 12 days',
    accent: '#FF725A'
  },
  {
    service: 'Disney+',
    icon: 'tv',
    amount: 249,
    dueIn: 'in 16 days',
    accent: '#6BA8FF'
  }
];

export const incomeItems: IncomeItem[] = [
  {
    source: 'Salary',
    amount: 54000,
    accent: '#5AAFFF',
    icon: 'wallet'
  },
  {
    source: 'Freelance',
    amount: 12500,
    accent: '#45C870',
    icon: 'sparkles'
  }
];
