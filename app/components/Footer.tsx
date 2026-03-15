// app/components/Footer.tsx
// PUBLIC Footer — only rendered inside app/(public)/layout.tsx
// Never shown on dashboard or admin pages.

import Link from "next/link";
import { Mail, PenLine, Twitter, Linkedin, Github, Globe } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-[#2a2a35] bg-[#0a0a0f] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-[#5a5a72] text-sm mb-4 md:mb-0">
            Made with <span className="text-[#f87171]">♥</span> by{" "}
            <span className="text-[#9898b0]">Nitrajsinh (Nikul) Solanki</span>
          </p>
          <div className="flex flex-wrap justify-center md:justify-end gap-5">
            <Link href="mailto:nrsolanki2005@gmail.com" className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors">
              <Mail size={16} />nrsolanki2005@gmail.com
            </Link>
            <Link href="https://medium.com/@nrsolanki2005" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors">
              <PenLine size={16} />Medium
            </Link>
            <Link href="https://x.com/Nitrajsinh_S" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors">
              <Twitter size={16} />X
            </Link>
            <Link href="https://www.linkedin.com/in/nitrajsinh-solanki-647b11293" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors">
              <Linkedin size={16} />LinkedIn
            </Link>
            <Link href="https://github.com/Nitrajsinh-Solanki" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors">
              <Github size={16} />GitHub
            </Link>
            <Link href="https://my-portfolio-xi-ochre-28.vercel.app/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors">
              <Globe size={16} />Portfolio
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}