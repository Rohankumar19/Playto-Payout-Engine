import { useEffect, useState } from "react"

const API = "http://localhost:8000/api/v1"
const fmt = (paise) => `Rs ${(paise / 100).toFixed(2)}`

export default function App() {
  const [merchants, setMerchants] = useState([])
  const [merchantId, setMerchantId] = useState("")
  const [dashboard, setDashboard] = useState(null)
  const [ledger, setLedger] = useState([])
  const [payouts, setPayouts] = useState([])
  const [amount, setAmount] = useState("")
  const [bankAccountId, setBankAccountId] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    fetch(`${API}/merchants/`).then((r) => r.json()).then((data) => {
      setMerchants(data)
      if (data[0]) setMerchantId(String(data[0].id))
    })
  }, [])

  useEffect(() => {
    if (!merchantId) return
    const load = () => {
      fetch(`${API}/merchants/${merchantId}/dashboard`).then((r) => r.json()).then(setDashboard)
      fetch(`${API}/merchants/${merchantId}/ledger`).then((r) => r.json()).then(setLedger)
      fetch(`${API}/payouts?merchant_id=${merchantId}`).then((r) => r.json()).then(setPayouts)
    }
    load()
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [merchantId])

  const submitPayout = async (event) => {
    event.preventDefault()
    const response = await fetch(`${API}/payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ merchant_id: Number(merchantId), amount_paise: Number(amount), bank_account_id: Number(bankAccountId) }),
    })
    const body = await response.json()
    setStatus(response.ok ? `Payout ${body.id} created` : `Error: ${body.detail}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-bold">Playto Payout Engine</h1>
        <select className="rounded border p-2" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}>
          {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {dashboard && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Available", dashboard.available_balance_paise], ["Held", dashboard.held_balance_paise], ["Credited", dashboard.total_credited_paise], ["Paid Out", dashboard.total_paid_out_paise]].map(([k, v]) => (
              <div key={k} className="rounded bg-white p-4 shadow">
                <div className="text-sm text-gray-500">{k}</div>
                <div className="text-lg font-semibold">{fmt(v)}</div>
              </div>
            ))}
          </div>
        )}

        <form className="space-y-2 rounded bg-white p-4 shadow" onSubmit={submitPayout}>
          <h2 className="font-semibold">Request Payout</h2>
          <input className="w-full rounded border p-2" placeholder="Amount paise" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="w-full rounded border p-2" placeholder="Bank account id" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} />
          <button className="rounded bg-black px-3 py-2 text-white">Submit</button>
          <div className="text-sm">{status}</div>
        </form>

        <div className="grid gap-6 md:grid-cols-2">
          <table className="rounded bg-white text-sm shadow">
            <thead><tr className="text-left"><th className="p-2">Entry</th><th className="p-2">Amount</th></tr></thead>
            <tbody>{ledger.slice(0, 12).map((entry) => <tr key={entry.id} className="border-t"><td className="p-2">{entry.entry_type}</td><td className="p-2">{fmt(entry.amount_paise)}</td></tr>)}</tbody>
          </table>
          <table className="rounded bg-white text-sm shadow">
            <thead><tr className="text-left"><th className="p-2">Payout</th><th className="p-2">Status</th></tr></thead>
            <tbody>{payouts.slice(0, 12).map((payout) => <tr key={payout.id} className="border-t"><td className="p-2">{fmt(payout.amount_paise)}</td><td className="p-2">{payout.status}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
