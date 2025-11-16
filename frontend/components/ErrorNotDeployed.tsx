export function errorNotDeployed(chainId: number | undefined) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card-solid rounded-3xl p-12 max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-red-600 mb-4">
            ⚠️ Contract Not Deployed
          </h1>
        </div>

        <div className="bg-red-50 rounded-2xl p-6 mb-6 border-2 border-red-200">
          <p className="text-lg text-blue-900 font-semibold mb-2">
            <span className="font-mono bg-red-100 px-2 py-1 rounded">PeerReview.sol</span> contract is not deployed on{" "}
            <span className="font-mono bg-yellow-100 px-2 py-1 rounded">chainId={chainId}</span>{" "}
            {chainId === 11155111 ? "(Sepolia)" : ""}
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
            <h2 className="text-xl font-bold text-blue-900 mb-3 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Issue Description
            </h2>
            <p className="text-blue-700">
              The <span className="font-mono bg-white px-2 py-1 rounded font-bold">PeerReview.sol</span> contract
              has either not been deployed yet, or the deployment address is missing
              from the ABI directory{" "}
              <span className="font-mono bg-white px-2 py-1 rounded font-bold">root/frontend/abi</span>.
            </p>
          </div>

          <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
            <h2 className="text-xl font-bold text-blue-900 mb-3 flex items-center gap-2">
              <span className="text-2xl">🔧</span>
              Solution: Deploy the Contract
            </h2>
            <p className="text-blue-700 mb-4">
              Run the following command to deploy{" "}
              <span className="font-mono bg-white px-2 py-1 rounded font-bold">PeerReview.sol</span>:
            </p>
            <div className="bg-blue-900 text-white rounded-xl p-6 font-mono">
              <p className="text-yellow-400 text-sm mb-2"># from &lt;root&gt;/backend</p>
              <p className="text-lg">
                npx hardhat deploy --network{" "}
                {chainId === 11155111 ? "sepolia" : "your-network-name"}
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200">
            <h2 className="text-xl font-bold text-blue-900 mb-3 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              Alternative Solution
            </h2>
            <p className="text-blue-700">
              Switch to the local{" "}
              <span className="font-mono bg-white px-2 py-1 rounded font-bold">Hardhat Node</span>{" "}
              using the MetaMask browser extension to test locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

