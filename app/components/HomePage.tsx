// src/components/HomePage.tsx

export default function HomePage() {
    return (
      <main className="max-w-7xl mx-auto px-6 py-16">
  
        {/* Hero Section */}
        <section className="text-center">
  
          <h1 className="text-5xl font-bold text-gray-900">
            Track Your Work Hours Smarter
          </h1>
  
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            Hourbit helps employees working in flexible timing environments
            easily track entry time, breaks, and productivity while calculating
            when they can leave the office.
          </p>
  
          <div className="mt-8 flex justify-center gap-6">
            <a
              href="/register"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Get Started
            </a>
  
            <a
              href="/login"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Login
            </a>
          </div>
  
        </section>
  
  
        {/* Features Section */}
        <section className="mt-24 grid md:grid-cols-3 gap-8 text-center">
  
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold">Track Entry & Exit</h3>
            <p className="text-gray-600 mt-2">
              Log your entry time and exit time easily.
            </p>
          </div>
  
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold">Manage Breaks</h3>
            <p className="text-gray-600 mt-2">
              Track lunch, tea, or custom breaks during work.
            </p>
          </div>
  
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold">Smart Leave Time</h3>
            <p className="text-gray-600 mt-2">
              Know exactly when you can leave after completing 8.5 hours.
            </p>
          </div>
  
        </section>
  
      </main>
    );
  }