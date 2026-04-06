import React, { createContext, useContext, useState } from 'react'

const RoleContext = createContext(null)

export function RoleProvider({ children }) {
  const [role, setRole] = useState('bank')
  const [companyId, setCompanyId] = useState(null)

  return (
    <RoleContext.Provider value={{ role, companyId, setRole, setCompanyId }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}
