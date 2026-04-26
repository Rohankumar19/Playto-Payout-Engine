import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Wallet, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, CreditCard, RefreshCw } from "lucide-react"

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
  const [merchants] = useState([
    {
      id: 1,
      name: "Acme Agency",
      email: "acme@example.com",
      bank_accounts: [
        { id: 101, account_name: "Acme Agency", account_number_masked: "XXXXXX1234", ifsc: "HDFC0001234" }
      ]
    }
  ])
  const [merchantId, setMerchantId] = useState("1")
  const [dashboard, setDashboard] = useState({
    available_balance_paise: 350000,
    held_balance_paise: 0,
    total_credited_paise: 350000,
    total_paid_out_paise: 0
  })
  const [ledger, setLedger] = useState([
    {
      id: 1,
      entry_type: "credit",
      amount_paise: 350000,
      reference_type: "seed",
      reference_id: 1,
      created_at: new Date().toISOString()
    }
  ])
  const [payouts, setPayouts] = useState([])
  const [amountRs, setAmountRs] = useState("")
  const [bankAccountId, setBankAccountId] = useState("101")
  const [status, setStatus] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedMerchant = merchants.find(m => String(m.id) === String(merchantId))

  const submitPayout = async (event) => {
    event.preventDefault()
    const amountPaise = Math.round(Number(amountRs) * 100)
    
    if (!amountRs || isNaN(amountRs) || amountPaise <= 0) {
      setStatus("Please enter a valid amount")
      return
    }
    if (amountPaise > dashboard.available_balance_paise) {
      setStatus("Error: insufficient_balance")
      return
    }

    setIsSubmitting(true)
    setStatus("")
    
    // Simulate network delay for API request
    await new Promise(r => setTimeout(r, 600))
    
    const payoutId = Math.floor(Math.random() * 10000)
    
    // 1. Create Payout & Hold
    const newPayout = {
      id: payoutId,
      amount_paise: amountPaise,
      bank_account: Number(bankAccountId),
      status: "pending",
      created_at: new Date().toISOString()
    }
    
    const newLedgerEntry = {
      id: Date.now(),
      entry_type: "hold",
      amount_paise: amountPaise,
      reference_type: "payout",
      reference_id: payoutId,
      created_at: new Date().toISOString()
    }

    setPayouts(prev => [newPayout, ...prev])
    setLedger(prev => [newLedgerEntry, ...prev])
    
    setDashboard(prev => ({
      ...prev,
      available_balance_paise: prev.available_balance_paise - amountPaise,
      held_balance_paise: prev.held_balance_paise + amountPaise
    }))

    setStatus(`Success! Payout #${payoutId} initiated.`)
    setAmountRs("")
    setIsSubmitting(false)

    // 2. Simulate Async Worker (Pending -> Processing)
    setTimeout(() => {
      setPayouts(prev => prev.map(p => p.id === payoutId ? { ...p, status: "processing" } : p))
      
      // 3. Simulate Bank Processing (Processing -> Completed)
      setTimeout(() => {
        setPayouts(prev => prev.map(p => p.id === payoutId ? { ...p, status: "completed" } : p))
        
        const debitEntry = {
          id: Date.now() + 1,
          entry_type: "debit",
          amount_paise: amountPaise,
          reference_type: "payout",
          reference_id: payoutId,
          created_at: new Date().toISOString()
        }
        
        setLedger(prev => [debitEntry, ...prev])
        setDashboard(prev => ({
          ...prev,
          held_balance_paise: prev.held_balance_paise - amountPaise,
          total_paid_out_paise: prev.total_paid_out_paise + amountPaise
        }))

      }, 2500)

    }, 1500)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Available Balance" value={fmt(dashboard.available_balance_paise)} icon={Wallet} colorClass="bg-blue-500/10 text-blue-400" />
          <StatCard title="Held Balance" value={fmt(dashboard.held_balance_paise)} icon={Clock} colorClass="bg-amber-500/10 text-amber-400" />
          <StatCard title="Total Credited" value={fmt(dashboard.total_credited_paise)} icon={ArrowDownRight} colorClass="bg-emerald-500/10 text-emerald-400" />
          <StatCard title="Total Paid Out" value={fmt(dashboard.total_paid_out_paise)} icon={ArrowUpRight} colorClass="bg-indigo-500/10 text-indigo-400" />
        </div>

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
                    <AnimatePresence>
                      {ledger.slice(0, 10).map((entry) => (
                        <motion.tr 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          key={entry.id} className="hover:bg-slate-700/20 transition-colors"
                        >
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
                        </motion.tr>
                      ))}
                    </AnimatePresence>
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
