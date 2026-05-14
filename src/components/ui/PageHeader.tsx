interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 pb-2 border-b border-gray-100 mb-1">
      <div>
        <h1
          style={{
            fontFamily: "'Jost', system-ui, sans-serif",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            lineHeight: 1.25,
            color: "#0F0F0F",
            marginBottom: subtitle ? "4px" : 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: "12px",
              color: "#737373",
              letterSpacing: "-0.005em",
              fontFamily: "'Jost', system-ui, sans-serif",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
