import { investmentRanges, type RangeKey, type TrendPoint } from './investments';

export { investmentRanges };
export type { RangeKey };

export type AccountOverviewSnapshot = {
  assets: number;
  debt: number;
  points: TrendPoint[];
};

export type CreditCardAccount = {
  balance: number;
  brand: string;
  label: string;
  utilizedLabel: string;
  visualColor: string;
};

export type DepositoryAccount = {
  changeLabel: string;
  current: number;
  label: string;
  name: string;
  visualColor: string;
};

export const accountOverviewSnapshots: Record<RangeKey, AccountOverviewSnapshot> = {
  '1W': {
    assets: 30980,
    debt: 2410,
    points: [
      { x: 0, y: 52 },
      { x: 12, y: 44 },
      { x: 24, y: 58 },
      { x: 36, y: 42 },
      { x: 48, y: 56 },
      { x: 60, y: 68 },
      { x: 72, y: 72 },
      { x: 84, y: 80 },
      { x: 96, y: 70 },
      { x: 108, y: 62 },
      { x: 120, y: 58 }
    ]
  },
  '1M': {
    assets: 31190,
    debt: 2525,
    points: [
      { x: 0, y: 48 },
      { x: 12, y: 38 },
      { x: 24, y: 54 },
      { x: 36, y: 40 },
      { x: 48, y: 62 },
      { x: 60, y: 78 },
      { x: 72, y: 78 },
      { x: 84, y: 88 },
      { x: 96, y: 66 },
      { x: 108, y: 56 },
      { x: 120, y: 44 }
    ]
  },
  '3M': {
    assets: 31435,
    debt: 2680,
    points: [
      { x: 0, y: 44 },
      { x: 10, y: 38 },
      { x: 20, y: 32 },
      { x: 30, y: 46 },
      { x: 40, y: 30 },
      { x: 50, y: 58 },
      { x: 60, y: 42 },
      { x: 70, y: 74 },
      { x: 80, y: 90 },
      { x: 90, y: 90 },
      { x: 100, y: 90 },
      { x: 110, y: 102 },
      { x: 120, y: 102 },
      { x: 130, y: 82 },
      { x: 140, y: 70 },
      { x: 150, y: 52 },
      { x: 160, y: 66 },
      { x: 170, y: 18 },
      { x: 180, y: 54 },
      { x: 190, y: 70 },
      { x: 200, y: 76 },
      { x: 210, y: 76 },
      { x: 220, y: 76 },
      { x: 230, y: 76 },
      { x: 240, y: 96 },
      { x: 250, y: 100 },
      { x: 260, y: 102 },
      { x: 270, y: 98 },
      { x: 280, y: 94 },
      { x: 290, y: 108 },
      { x: 300, y: 122 }
    ]
  },
  YTD: {
    assets: 31980,
    debt: 3010,
    points: [
      { x: 0, y: 38 },
      { x: 12, y: 34 },
      { x: 24, y: 44 },
      { x: 36, y: 54 },
      { x: 48, y: 62 },
      { x: 60, y: 76 },
      { x: 72, y: 70 },
      { x: 84, y: 64 },
      { x: 96, y: 78 },
      { x: 108, y: 94 },
      { x: 120, y: 112 }
    ]
  },
  '1Y': {
    assets: 32760,
    debt: 3320,
    points: [
      { x: 0, y: 32 },
      { x: 12, y: 28 },
      { x: 24, y: 36 },
      { x: 36, y: 44 },
      { x: 48, y: 58 },
      { x: 60, y: 72 },
      { x: 72, y: 86 },
      { x: 84, y: 80 },
      { x: 96, y: 94 },
      { x: 108, y: 108 },
      { x: 120, y: 126 }
    ]
  }
};

export const creditCardsTotalLabel = '₹ 2,680.00';

export const creditCards: CreditCardAccount[] = [
  {
    balance: 1446,
    brand: 'SBI',
    label: 'Credit Card',
    utilizedLabel: '26.00%',
    visualColor: '#5582B6'
  },
  {
    balance: 1234,
    brand: 'HDFC',
    label: 'Credit Card',
    utilizedLabel: '26.00%',
    visualColor: '#C7191E'
  }
];

export const depositoryTotalLabel = '₹ 4,000.00';

export const depositoryAccounts: DepositoryAccount[] = [
  {
    changeLabel: '0.00%',
    current: 4000,
    label: 'Banking',
    name: 'Canara Bank',
    visualColor: '#C7191E'
  }
];
