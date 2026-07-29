import React from "react";

type StateMessageProps = {
  children: React.ReactNode;
  detail?: string;
};

export function StateMessage({ children, detail }: StateMessageProps) {
  return (
    <div className="grid gap-sm py-2xl text-center text-[13px] text-text-secondary">
      <div>{children}</div>
      {detail ? <div className="text-xs text-text-muted">{detail}</div> : null}
    </div>
  );
}
