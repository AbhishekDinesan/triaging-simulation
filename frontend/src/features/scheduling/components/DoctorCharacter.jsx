function DoctorCharacter() {
  return (
    <div className="doctor-character">
      <div className="doctor-glow" />
      <svg className="doctor-svg" viewBox="0 0 200 320" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="100" cy="62" rx="52" ry="54" fill="#3b2314" />
        <ellipse cx="100" cy="72" rx="44" ry="46" fill="#c68642" />
        <ellipse cx="82" cy="68" rx="5" ry="5.5" fill="#1e1e1e" />
        <ellipse cx="118" cy="68" rx="5" ry="5.5" fill="#1e1e1e" />
        <circle cx="84" cy="66" r="1.8" fill="#fff" />
        <circle cx="120" cy="66" r="1.8" fill="#fff" />
        <path d="M73 59 Q82 54 91 59" stroke="#2a1a0a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M109 59 Q118 54 127 59" stroke="#2a1a0a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M85 88 Q100 102 115 88" stroke="#1e1e1e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M97 78 Q100 84 103 78" stroke="#a0622e" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <rect x="88" y="112" width="24" height="18" rx="4" fill="#c68642" />
        <path
          d="M52 130 Q52 125 60 122 L88 118 H112 L140 122 Q148 125 148 130 V260 Q148 268 140 268 H60 Q52 268 52 260 Z"
          fill="#f0f4f8"
          stroke="#d1d9e0"
          strokeWidth="1.5"
        />
        <path d="M88 118 L95 165 L100 155 L105 165 L112 118" fill="#e2e8f0" />
        <rect x="93" y="155" width="14" height="50" rx="2" fill="#2a9d8f" />
        <circle cx="100" cy="190" r="3" fill="#1e6b5c" />
        <circle cx="100" cy="210" r="3" fill="#1e6b5c" />
        <circle cx="100" cy="230" r="3" fill="#1e6b5c" />
        <path
          d="M78 140 Q68 160 72 190 Q74 202 84 200"
          stroke="#4a5568"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="84" cy="200" r="6" fill="#4a5568" />
        <circle cx="84" cy="200" r="3" fill="#718096" />
        <rect x="120" y="145" width="20" height="28" rx="3" fill="#fff" stroke="#d1d9e0" strokeWidth="1" />
        <rect x="124" y="150" width="12" height="3" rx="1" fill="#2a9d8f" />
        <rect x="124" y="156" width="12" height="2" rx="1" fill="#cbd5e0" />
        <rect x="124" y="161" width="8" height="2" rx="1" fill="#cbd5e0" />
        <path d="M52 135 Q38 170 44 210" stroke="#f0f4f8" strokeWidth="18" fill="none" strokeLinecap="round" />
        <circle cx="44" cy="214" r="10" fill="#c68642" />
        <g className="doctor-wave">
          <path d="M148 135 Q170 110 165 80" stroke="#f0f4f8" strokeWidth="18" fill="none" strokeLinecap="round" />
          <circle cx="165" cy="76" r="10" fill="#c68642" />
          <path d="M163 67 Q162 58 166 54" stroke="#c68642" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M167 67 Q168 57 172 54" stroke="#c68642" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M171 69 Q174 60 178 58" stroke="#c68642" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </g>
        <rect x="68" y="260" width="26" height="44" rx="6" fill="#334155" />
        <rect x="106" y="260" width="26" height="44" rx="6" fill="#334155" />
        <ellipse cx="81" cy="308" rx="18" ry="8" fill="#1e293b" />
        <ellipse cx="119" cy="308" rx="18" ry="8" fill="#1e293b" />
      </svg>
    </div>
  )
}

export default DoctorCharacter
