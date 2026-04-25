import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Wallet, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, CreditCard, RefreshCw } from "lucide-react"

const API = "http://localhost:8000/api/v1"
const fmt = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden rounded-2xl bg-slate-800/50 p-6 border border-slate-700/50 backdrop-blur-xl"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </motion.div>
)

const StatusBadge = ({ status }) => {
  const styles = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  }
  const icons = {
    pending: Clock,
    processing: RefreshCw,
    completed: CheckCircle2,
    failed: XCircle
  }
  const Icon = icons[status] || Clock
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
      <span className="capitalize">{status}</span>
    </span>
  )
}

export default function App() {
  const [merchants, setMerchants] = useState([])
  const [merchantId, setMerchantId] = useState("")
  const [dashboard, setDashboard] = useState(null)
  const [ledger, setLedger] = useState([])
  const [payouts, setPayouts] = useState([])
  const [amountRs, setAmountRs] = useState("")
  const [bankAccountId, setBankAccountId] = useState("")
  const [status, setStatus] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedMerchant = merchants.find(m => String(m.id) === String(merchantId))

  useEffect(() => {
    fetch(`${API}/merchants/`).then((r) => r.json()).then((data) => {
      setMerchants(data)
      if (data.length > 0) {
        setMerchantId(String(data[0].id))
        if (data[0].bank_accounts?.length > 0) {
          setBankAccountId(String(data[0].bank_accounts[0].id))
        }
      }
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
    const interval = setInterval(load, 2000)
    return () => clearInterval(interval)
  }, [merchantId])

  useEffect(() => {
    if (selectedMerchant?.bank_accounts?.length > 0 && !selectedMerchant.bank_accounts.find(b => String(b.id) === String(bankAccountId))) {
      setBankAccountId(String(selectedMerchant.bank_accounts[0].id))
    }
  }, [merchantId, selectedMerchant])

  const submitPayout = async (event) => {
    event.preventDefault()
    if (!amountRs || isNaN(amountRs) || Number(amountRs) <= 0) {
      setStatus("Please enter a valid amount")
      return
    }
    setIsSubmitting(true)
    setStatus("")
    
    try {
      const response = await fetch(`${API}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ 
          merchant_id: Number(merchantId), 
          amount_paise: Math.round(Number(amountRs) * 100), 
          bank_account_id: Number(bankAccountId) 
        }),
      })
      const body = await response.json()
      if (response.ok) {
        setStatus(`Success! Payout #${body.id} initiated.`)
        setAmountRs("")
      } else {
        setStatus(`Error: ${body.detail || "Something went wrong"}`)
      }
    } catch (e) {
      setStatus(`Network Error: Could not reach server`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Playto Payouts
            </h1>
            <p className="text-slate-400 mt-1">Cross-border payment infrastructure</p>
          </div>
          
          <div className="relative">
            <select 
              className="appearance-none bg-slate-800/80 border border-slate-700 text-white pl-4 pr-10 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-lg"
              value={merchantId} 
              onChange={(e) => setMerchantId(e.target.value)}
            >
              {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        {dashboard && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Available Balance" value={fmt(dashboard.available_balance_paise)} icon={Wallet} colorClass="bg-blue-500/10 text-blue-400" />
            <StatCard title="Held Balance" value={fmt(dashboard.held_balance_paise)} icon={Clock} colorClass="bg-amber-500/10 text-amber-400" />
            <StatCard title="Total Credited" value={fmt(dashboard.total_credited_paise)} icon={ArrowDownRight} colorClass="bg-emerald-500/10 text-emerald-400" />
            <StatCard title="Total Paid Out" value={fmt(dashboard.total_paid_out_paise)} icon={ArrowUpRight} colorClass="bg-indigo-500/10 text-indigo-400" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Payouts Table */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
              <div className="p-5 border-b border-slate-700/50">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                  Recent Payouts
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800/50 text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Bank Account</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    <AnimatePresence>
                      {payouts.slice(0, 10).map((payout) => {
                        const bank = selectedMerchant?.bank_accounts?.find(b => b.id === payout.bank_account)
                        return (
                        <motion.tr 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          key={payout.id} className="hover:bg-slate-700/20 transition-colors"
                        >
                          <td className="px-5 py-4 font-medium text-white">{fmt(payout.amount_paise)}</td>
                          <td className="px-5 py-4 text-slate-400">{bank ? `${bank.account_name} (..${bank.account_number_masked.slice(-4)})` : `ID: ${payout.bank_account}`}</td>
                          <td className="px-5 py-4 text-slate-400">{new Date(payout.created_at).toLocaleDateString()}</td>
                          <td className="px-5 py-4"><StatusBadge status={payout.status} /></td>
                        </motion.tr>
                      )})}
                    </AnimatePresence>
                    {payouts.length === 0 && (
                      <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-500">No payouts found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
              <div className="p-5 border-b border-slate-700/50">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-emerald-400" />
                  Ledger History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800/50 text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Ref</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {ledger.slice(0, 10).map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-3 capitalize">
                          <span className={`inline-flex items-center gap-1.5 ${
                            entry.entry_type === 'credit' ? 'text-emerald-400' :
                            entry.entry_type === 'debit' ? 'text-blue-400' :
                            entry.entry_type === 'refund' ? 'text-purple-400' : 'text-amber-400'
                          }`}>
                            {entry.entry_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-medium text-white">{fmt(entry.amount_paise)}</td>
                        <td className="px-5 py-3 text-slate-400">{entry.reference_type} #{entry.reference_id}</td>
                        <td className="px-5 py-3 text-slate-500">{new Date(entry.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar - Request Payout Form */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-b from-slate-800/60 to-slate-800/30 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-xl shadow-xl sticky top-8">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                 <Wallet className="w-5 h-5 text-blue-400" />
                 Request Payout
              </h2>
              <form onSubmit={submitPayout} className="space-y-5">
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
                    <input 
                      type="number" 
                      step="0.01"
                      min="1"
                      className="w-full bg-slate-900/50 border border-slate-700 text-white pl-9 pr-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600 font-medium" 
                      placeholder="0.00" 
                      value={amountRs} 
                      onChange={(e) => setAmountRs(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Destination Bank</label>
                  <div className="relative">
                    <select 
                      className="w-full appearance-none bg-slate-900/50 border border-slate-700 text-white pl-4 pr-10 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                      value={bankAccountId} 
                      onChange={(e) => setBankAccountId(e.target.value)}
                    >
                      {selectedMerchant?.bank_accounts?.map(b => (
                        <option key={b.id} value={b.id}>{b.account_name} (..{b.account_number_masked.slice(-4)})</option>
                      )) || <option value="">No bank accounts</option>}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                <button 
                  disabled={isSubmitting || !bankAccountId}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 mt-2"
                >
                  {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Initiate Transfer"}
                </button>

                <AnimatePresence>
                  {status && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className={`p-3 rounded-xl text-sm font-medium border ${
                        status.startsWith('Error') || status.startsWith('Network') || status.startsWith('Please')
                          ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {status}
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
