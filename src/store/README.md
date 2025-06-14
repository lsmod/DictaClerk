# Redux Toolkit Frontend State Machine

This implementation provides a comprehensive Redux Toolkit-based state management system that mirrors and synchronizes with the backend `AppStateMachine`.

## 🏗️ Architecture Overview

### Core Components

1. **Redux Store** (`store/store.ts`) - Main store configuration
2. **App Slice** (`store/slices/appSlice.ts`) - State management with reducers
3. **Backend Sync** (`store/backendSync.ts`) - Event-driven synchronization
4. **Builder Pattern** (`store/testUtils/AppStateBuilder.ts`) - Immutable test state construction
5. **Hooks** (`store/hooks.ts`, `hooks/useBackendCommands.ts`) - React integration

### State Structure

```typescript
interface AppState {
  // Core state
  status: AppStatus

  // Window management
  mainWindowVisible: boolean
  hasModalWindow: boolean

  // Recording data
  recordingStartTime: number | null
  recordingTime: number

  // Processing data
  originalTranscript: string | null
  finalText: string | null
  profileId: string | null

  // Error handling
  error: string | null

  // Backend sync
  lastBackendSync: number
  backendConnected: boolean
}
```

## 🔄 Backend Synchronization

### Event-Driven Architecture

The frontend automatically synchronizes with the backend state machine through Tauri events:

- **`app-state-changed`** - Backend state transitions
- **`processing-data-updated`** - Processing data updates
- **`app-error`** - Error notifications

### Backend Commands

```typescript
interface BackendCommands {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => Promise<void>
  openSettings: () => Promise<void>
  closeSettings: () => Promise<void>
  acknowledgeError: () => Promise<void>
  reformatWithProfile: (profileId: string) => Promise<void>
  showMainWindow: () => Promise<void>
  hideMainWindow: () => Promise<void>
}
```

## 🧪 Testing with Builder Pattern

### AppStateBuilder Usage

```typescript
// Create test states fluently
const recordingState = new AppStateBuilder()
  .recording()
  .withRecordingTime(5000)
  .build()

const errorState = new AppStateBuilder()
  .errorState('transcription')
  .withError('Custom error message')
  .build()

const processingState = new AppStateBuilder()
  .withProcessingComplete('Original text', 'Formatted text', 'profile-id')
  .build()
```

### Test Coverage

- ✅ 22 comprehensive tests
- ✅ All state transitions
- ✅ Backend synchronization
- ✅ Error handling
- ✅ Builder pattern validation
- ✅ Immutability guarantees

## 🚀 Usage Examples

### 1. Basic Setup

```tsx
import { ReduxProvider } from './components/ReduxProvider'
import { App } from './App'

function Root() {
  return (
    <ReduxProvider>
      <App />
    </ReduxProvider>
  )
}
```

### 2. Using State in Components

```tsx
import { useAppSelector } from './store/hooks'
import { useBackendCommands } from './hooks/useBackendCommands'

function RecordingComponent() {
  const { status, recordingTime } = useAppSelector((state) => state.app)
  const { startRecording, stopRecording } = useBackendCommands()

  return (
    <div>
      <p>Status: {status}</p>
      {status === 'recording' && <p>Time: {recordingTime}ms</p>}
      <button onClick={startRecording}>Start</button>
      <button onClick={stopRecording}>Stop</button>
    </div>
  )
}
```

### 3. Error Handling

```tsx
function ErrorDisplay() {
  const { error, status } = useAppSelector((state) => state.app)
  const { acknowledgeError } = useBackendCommands()

  if (!error || !status.startsWith('error-')) return null

  return (
    <div className="error-banner">
      <p>{error}</p>
      <button onClick={acknowledgeError}>Dismiss</button>
    </div>
  )
}
```

## 🔧 Key Features

### ✅ Immutability

- Redux Toolkit with Immer for immutable updates
- Builder pattern prevents accidental mutations in tests

### ✅ FSM Validation

- State transitions validated through Redux reducers
- Backend state machine mirrored on frontend

### ✅ Event-Driven Sync

- Real-time synchronization via Tauri events
- Replaces polling with efficient event listeners

### ✅ Type Safety

- Full TypeScript support
- Typed hooks and selectors

### ✅ Test Ergonomics

- Fluent builder pattern for test state construction
- Comprehensive test coverage with Vitest

### ✅ Error Handling

- Centralized error state management
- User acknowledgment flow

## 📁 File Structure

```
src/
├── store/
│   ├── store.ts                 # Main store configuration
│   ├── hooks.ts                 # Typed Redux hooks
│   ├── backendSync.ts           # Backend synchronization
│   ├── slices/
│   │   └── appSlice.ts          # Main app state slice
│   ├── testUtils/
│   │   └── AppStateBuilder.ts   # Builder pattern for tests
│   └── __tests__/
│       └── appSlice.test.ts     # Comprehensive test suite
├── hooks/
│   └── useBackendCommands.ts    # Backend command hook
├── components/
│   ├── ReduxProvider.tsx        # Redux provider wrapper
│   └── AppStateDemo.tsx         # Demo component
└── examples/
    └── ReduxIntegrationExample.tsx # Integration examples
```

## 🔄 Migration from Context

To migrate from the existing React Context:

1. **Wrap app with ReduxProvider**
2. **Replace useContext with useAppSelector**
3. **Replace direct state updates with useBackendCommands**
4. **Update components to use new state structure**

### Before (Context)

```tsx
const { isRecording, startRecording } = useRecordingContext()
```

### After (Redux)

```tsx
const { status } = useAppSelector((state) => state.app)
const { startRecording } = useBackendCommands()
const isRecording = status === 'recording'
```

## 🎯 Benefits

1. **Predictable State Management** - Redux pattern with immutable updates
2. **Real-time Backend Sync** - Event-driven instead of polling
3. **Comprehensive Testing** - Builder pattern + 22 test cases
4. **Type Safety** - Full TypeScript integration
5. **Developer Experience** - Redux DevTools support
6. **Scalability** - Easy to extend with new slices and features
