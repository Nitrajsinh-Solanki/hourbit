// app/dashboard/page.tsx

export default function DashboardPage() {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-3">
            Welcome to <span className="text-[#7c6ef3]">HourBit</span> Dashboard
          </h1>
          <p className="text-[#9898b0] text-sm">
            Your dashboard features will appear here.
          </p>
        </div>
      </div>
    );
  }