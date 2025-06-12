import React from 'react'
import { Provider } from 'react-redux'
import { store } from '../store/store'

interface ReduxProviderProps {
  children: React.ReactNode
}

export const ReduxProvider: React.FC<ReduxProviderProps> = ({ children }) => {
  return <Provider store={store}>{children}</Provider>
}
