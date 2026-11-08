import { ReactNode } from 'react';
export function Table({ heads, children }: { heads: string[]; children: ReactNode }) { return <div className="table"><table><thead><tr>{heads.map(head => <th key={head}>{head}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
