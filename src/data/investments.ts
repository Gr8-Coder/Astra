export type RangeKey = '1W' | '1M' | '3M' | 'YTD' | '1Y';

export type TrendPoint = {
  x: number;
  y: number;
};

export type TopMover = {
  changeLabel: string;
  direction: 'down' | 'up';
  points: TrendPoint[];
  symbol: string;
};

export type LinkedAccount = {
  app: string;
  changeLabel: string;
  direction: 'down' | 'up';
  points: TrendPoint[];
};

export const investmentRanges: RangeKey[] = ['1W', '1M', '3M', 'YTD', '1Y'];

export const portfolioSnapshots: Record<
  RangeKey,
  {
    balance: number;
    label: string;
    performanceLabel: string;
    points: TrendPoint[];
  }
> = {
  '1W': {
    balance: 28140,
    label: 'live balance estimate',
    performanceLabel: '2.14%',
    points: [
      { x: 0, y: 78 },
      { x: 8, y: 72 },
      { x: 16, y: 82 },
      { x: 24, y: 74 },
      { x: 32, y: 70 },
      { x: 40, y: 63 },
      { x: 48, y: 66 },
      { x: 56, y: 58 },
      { x: 64, y: 60 },
      { x: 72, y: 52 },
      { x: 80, y: 48 },
      { x: 88, y: 50 },
      { x: 96, y: 46 }
    ]
  },
  '1M': {
    balance: 28680,
    label: 'live balance estimate',
    performanceLabel: '3.82%',
    points: [
      { x: 0, y: 82 },
      { x: 8, y: 74 },
      { x: 16, y: 80 },
      { x: 24, y: 68 },
      { x: 32, y: 72 },
      { x: 40, y: 64 },
      { x: 48, y: 61 },
      { x: 56, y: 54 },
      { x: 64, y: 52 },
      { x: 72, y: 56 },
      { x: 80, y: 49 },
      { x: 88, y: 44 },
      { x: 96, y: 47 }
    ]
  },
  '3M': {
    balance: 29120,
    label: 'live balance estimate',
    performanceLabel: '5.96%',
    points: [
      { x: 0, y: 88 },
      { x: 6, y: 82 },
      { x: 12, y: 90 },
      { x: 18, y: 84 },
      { x: 24, y: 86 },
      { x: 30, y: 78 },
      { x: 36, y: 82 },
      { x: 42, y: 72 },
      { x: 48, y: 72 },
      { x: 54, y: 61 },
      { x: 60, y: 56 },
      { x: 66, y: 62 },
      { x: 72, y: 60 },
      { x: 78, y: 58 },
      { x: 84, y: 60 },
      { x: 90, y: 72 },
      { x: 96, y: 72 },
      { x: 102, y: 64 },
      { x: 108, y: 62 },
      { x: 114, y: 58 },
      { x: 120, y: 50 },
      { x: 126, y: 54 },
      { x: 132, y: 60 },
      { x: 138, y: 66 },
      { x: 144, y: 68 },
      { x: 150, y: 72 },
      { x: 156, y: 56 },
      { x: 162, y: 60 },
      { x: 168, y: 62 },
      { x: 174, y: 68 },
      { x: 180, y: 72 }
    ]
  },
  YTD: {
    balance: 30460,
    label: 'live balance estimate',
    performanceLabel: '8.41%',
    points: [
      { x: 0, y: 96 },
      { x: 10, y: 90 },
      { x: 20, y: 92 },
      { x: 30, y: 86 },
      { x: 40, y: 77 },
      { x: 50, y: 74 },
      { x: 60, y: 68 },
      { x: 70, y: 62 },
      { x: 80, y: 64 },
      { x: 90, y: 56 },
      { x: 100, y: 48 },
      { x: 110, y: 44 },
      { x: 120, y: 38 }
    ]
  },
  '1Y': {
    balance: 32640,
    label: 'live balance estimate',
    performanceLabel: '12.73%',
    points: [
      { x: 0, y: 102 },
      { x: 10, y: 98 },
      { x: 20, y: 92 },
      { x: 30, y: 88 },
      { x: 40, y: 82 },
      { x: 50, y: 76 },
      { x: 60, y: 74 },
      { x: 70, y: 66 },
      { x: 80, y: 61 },
      { x: 90, y: 58 },
      { x: 100, y: 50 },
      { x: 110, y: 46 },
      { x: 120, y: 40 }
    ]
  }
};

export const topMovers: TopMover[] = [
  {
    changeLabel: '3.76%',
    direction: 'down',
    points: [
      { x: 0, y: 24 },
      { x: 18, y: 72 },
      { x: 34, y: 58 },
      { x: 50, y: 68 },
      { x: 66, y: 60 },
      { x: 84, y: 62 }
    ],
    symbol: 'TCPL'
  },
  {
    changeLabel: '2.25%',
    direction: 'down',
    points: [
      { x: 0, y: 26 },
      { x: 16, y: 70 },
      { x: 34, y: 56 },
      { x: 50, y: 66 },
      { x: 68, y: 58 },
      { x: 84, y: 60 }
    ],
    symbol: 'Paytm'
  },
  {
    changeLabel: '3.96%',
    direction: 'up',
    points: [
      { x: 0, y: 62 },
      { x: 18, y: 58 },
      { x: 34, y: 54 },
      { x: 50, y: 40 },
      { x: 66, y: 44 },
      { x: 84, y: 18 }
    ],
    symbol: 'HDFC'
  },
  {
    changeLabel: '4.51%',
    direction: 'up',
    points: [
      { x: 0, y: 70 },
      { x: 16, y: 64 },
      { x: 34, y: 48 },
      { x: 52, y: 52 },
      { x: 70, y: 28 },
      { x: 84, y: 16 }
    ],
    symbol: 'INFY'
  },
  {
    changeLabel: '1.84%',
    direction: 'down',
    points: [
      { x: 0, y: 28 },
      { x: 18, y: 52 },
      { x: 34, y: 48 },
      { x: 52, y: 60 },
      { x: 70, y: 56 },
      { x: 84, y: 62 }
    ],
    symbol: 'TCS'
  },
  {
    changeLabel: '2.91%',
    direction: 'up',
    points: [
      { x: 0, y: 62 },
      { x: 18, y: 60 },
      { x: 34, y: 48 },
      { x: 52, y: 42 },
      { x: 70, y: 24 },
      { x: 84, y: 18 }
    ],
    symbol: 'RELI'
  }
];

export const linkedAccounts: LinkedAccount[] = [
  {
    app: 'Zerodha',
    changeLabel: '12.34%',
    direction: 'up',
    points: [
      { x: 0, y: 46 },
      { x: 10, y: 42 },
      { x: 20, y: 50 },
      { x: 30, y: 28 },
      { x: 40, y: 34 },
      { x: 50, y: 14 },
      { x: 60, y: 40 },
      { x: 70, y: 10 },
      { x: 80, y: 20 },
      { x: 90, y: 12 },
      { x: 100, y: 24 }
    ]
  },
  {
    app: 'Wazirx',
    changeLabel: '4.12%',
    direction: 'down',
    points: [
      { x: 0, y: 14 },
      { x: 10, y: 28 },
      { x: 20, y: 22 },
      { x: 30, y: 32 },
      { x: 40, y: 24 },
      { x: 50, y: 38 },
      { x: 60, y: 36 },
      { x: 70, y: 44 },
      { x: 80, y: 42 },
      { x: 90, y: 48 },
      { x: 100, y: 44 }
    ]
  },
  {
    app: 'Groww',
    changeLabel: '3.36%',
    direction: 'up',
    points: [
      { x: 0, y: 42 },
      { x: 10, y: 38 },
      { x: 20, y: 52 },
      { x: 30, y: 48 },
      { x: 40, y: 28 },
      { x: 50, y: 40 },
      { x: 60, y: 20 },
      { x: 70, y: 30 },
      { x: 80, y: 18 },
      { x: 90, y: 22 },
      { x: 100, y: 16 }
    ]
  }
];
