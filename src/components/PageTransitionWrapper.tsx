'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const PageTransition = dynamic(() => import('./PageTransition'), { ssr: false });

export default function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
