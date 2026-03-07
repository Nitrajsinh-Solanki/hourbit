// src/components/Footer.tsx

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t mt-16">
      <div className="max-w-7xl mx-auto px-6 py-4 text-center text-sm text-gray-600">

        Made with Love — Nitrajsinh (Nikul) Solanki | 

        <Link
          href="https://www.linkedin.com/in/nitrajsinh-solanki-647b11293"
          className="mx-2 hover:text-blue-600"
        >
          LinkedIn
        </Link>

        <Link
          href="https://github.com/Nitrajsinh-Solanki"
          className="mx-2 hover:text-blue-600"
        >
          GitHub
        </Link>

        <Link
          href="https://my-portfolio-xi-ochre-28.vercel.app/"
          className="mx-2 hover:text-blue-600"
        >
          Portfolio
        </Link>

      </div>
    </footer>
  );
}