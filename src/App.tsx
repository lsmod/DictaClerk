import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

function App() {
  const [greetMsg, setGreetMsg] = useState('')
  const [name, setName] = useState('')

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke('greet', { name }))
  }

  return (
    <main className="container">
      <h1>Welcome to DictaClerk</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
          <img
            src="/src/assets/vite.svg"
            className="logo vite"
            alt="Vite logo"
          />
        </a>
        <a href="https://tauri.app" target="_blank" rel="noreferrer">
          <img
            src="/src/assets/tauri.svg"
            className="logo tauri"
            alt="Tauri logo"
          />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img
            src="/src/assets/react.svg"
            className="logo react"
            alt="React logo"
          />
        </a>
      </div>
      <p>Voice transcription tool - DictaClerk scaffold setup complete!</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          greet()
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  )
}

export default App
