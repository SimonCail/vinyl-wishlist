import { useState } from 'react'

const KEY = 'vinyl-wishlist-name'

export function useUserName() {
  const [name, setNameState] = useState(() => localStorage.getItem(KEY) || '')

  function setName(value) {
    localStorage.setItem(KEY, value)
    setNameState(value)
  }

  return { name, setName }
}