#!/usr/bin/env python3
# get_all_story_assets.py - A comprehensive script to fetch all assets from all contracts with complete metadata

import json
import argparse
import sys
import requests
from datetime import datetime
from web3 import Web3
from web3.middleware import geth_poa_middleware
from concurrent.futures import ThreadPoolExecutor, as_completed

# Story Protocol RPC endpoint
STORY_RPC_URL = "https://aeneid.storyrpc.io/"

# ERC-721 ABI (minimal interface for querying NFTs)
ERC721_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Known IP Asset Registry addresses
KNOWN_IP_ASSET_ADDRESSES = [
    "0x7CaFa3F46E3F07dE23ccE856e92BB5460AC77e98",  # IP Asset Registry
    "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC",  # Programmable IP License Token
    "0x76ba2c2428F756010683c4ece6f49296b4756C1A",  # Story Portal Default Collection
    "0x937BEF10bA6Fb941ED84b8d249Abc76031429A9a",  # Story NFT
    "0x98Caab9438337Aa19AC2ef05864A5E3273f39Dab",  # Test Collection
    "0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc",  # Test NFTs
    "0x4b2bf7072F4EC096896eC5a16282293756fE0d83",  # story test collection
]

def connect_to_rpc():
    """Connect to the Story Protocol RPC endpoint"""
    w3 = Web3(Web3.HTTPProvider(STORY_RPC_URL))
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)  # For compatibility with PoA chains
    return w3

def get_latest_block_number(w3, debug=False):
    """Get the latest block number"""
    try:
        block_number = w3.eth.block_number
        if debug:
            print(f"Latest block number: {block_number}")
        return block_number
    except Exception as e:
        if debug:
            print(f"Error getting latest block number: {e}")
        return None

def get_contract_info(w3, address, debug=False):
    """Get basic information about a contract with proper checksum handling"""
    try:
        # Convert address to valid checksum address
        checksum_address = Web3.to_checksum_address(address)
        
        if debug:
            print(f"Original address: {address}")
            print(f"Checksum address: {checksum_address}")
        
        contract = w3.eth.contract(address=checksum_address, abi=ERC721_ABI)
        
        try:
            name = contract.functions.name().call()
        except Exception as e:
            if debug:
                print(f"Error getting name: {e}")
            name = "Unknown"
        
        try:
            symbol = contract.functions.symbol().call()
        except Exception as e:
            if debug:
                print(f"Error getting symbol: {e}")
            symbol = "Unknown"
        
        try:
            total_supply = contract.functions.totalSupply().call()
        except Exception as e:
            if debug:
                print(f"Error getting total supply: {e}")
            total_supply = 0
        
        info = {
            "address": checksum_address,
            "name": name,
            "symbol": symbol,
            "total_supply": total_supply
        }
        
        if debug:
            print(f"Contract info: {info}")
        
        return info
    except Exception as e:
        if debug:
            print(f"Error getting contract info for {address}: {e}")
        return None

def get_token_ids(w3, contract_address, total_supply, debug=False, max_ids_to_check=None, batch_size=100):
    """Get all token IDs for a contract using batch processing for efficiency"""
    try:
        # Convert address to valid checksum address
        checksum_address = Web3.to_checksum_address(contract_address)
        
        contract = w3.eth.contract(address=checksum_address, abi=ERC721_ABI)
        token_ids = []
        
        # Determine the range of token IDs to check
        if max_ids_to_check:
            max_token_id = max_ids_to_check
        else:
            max_token_id = max(10000, total_supply * 2)  # Try a reasonable range
        
        if debug:
            print(f"Scanning up to token ID {max_token_id} for contract {checksum_address}")
        
        # Process in batches for better performance
        for batch_start in range(1, max_token_id + 1, batch_size):
            batch_end = min(batch_start + batch_size - 1, max_token_id)
            batch_ids = []
            
            if debug:
                print(f"Checking token IDs {batch_start} to {batch_end}...")
            
            # Use ThreadPoolExecutor for parallel processing
            with ThreadPoolExecutor(max_workers=10) as executor:
                # Create a future for each token ID check
                future_to_id = {
                    executor.submit(check_token_exists, contract, token_id): token_id
                    for token_id in range(batch_start, batch_end + 1)
                }
                
                # Process completed futures
                for future in as_completed(future_to_id):
                    token_id = future_to_id[future]
                    try:
                        exists = future.result()
                        if exists:
                            batch_ids.append(token_id)
                    except Exception:
                        pass
            
            token_ids.extend(batch_ids)
            
            if debug:
                print(f"Found {len(batch_ids)} tokens in batch, {len(token_ids)} total so far")
        
        if debug:
            print(f"Found {len(token_ids)} tokens for contract {checksum_address}")
        
        return token_ids
    except Exception as e:
        if debug:
            print(f"Error getting token IDs for {contract_address}: {e}")
        return []

def check_token_exists(contract, token_id):
    """Check if a token ID exists by calling ownerOf"""
    try:
        contract.functions.ownerOf(token_id).call()
        return True
    except Exception:
        return False

def get_token_metadata(w3, contract_address, token_id, debug=False):
    """Get metadata for a specific token"""
    try:
        # Convert address to valid checksum address
        checksum_address = Web3.to_checksum_address(contract_address)
        
        contract = w3.eth.contract(address=checksum_address, abi=ERC721_ABI)
        
        # Get token URI
        try:
            token_uri = contract.functions.tokenURI(token_id).call()
        except Exception as e:
            if debug:
                print(f"Error getting token URI: {e}")
            token_uri = None
        
        # Get token owner
        try:
            owner = contract.functions.ownerOf(token_id).call()
        except Exception as e:
            if debug:
                print(f"Error getting owner: {e}")
            owner = None
        
        # Fetch metadata from token URI if available
        full_metadata = None
        if token_uri:
            try:
                if token_uri.startswith('http'):
                    response = requests.get(token_uri)
                    if response.status_code == 200:
                        full_metadata = response.json()
                elif token_uri.startswith('ipfs://'):
                    ipfs_hash = token_uri.replace('ipfs://', '')
                    ipfs_url = f"https://ipfs.io/ipfs/{ipfs_hash}"
                    response = requests.get(ipfs_url)
                    if response.status_code == 200:
                        full_metadata = response.json()
                elif token_uri.startswith('data:application/json;base64,'):
                    import base64
                    json_data = token_uri.replace('data:application/json;base64,', '')
                    decoded_data = base64.b64decode(json_data).decode('utf-8')
                    full_metadata = json.loads(decoded_data)
            except Exception as e:
                if debug:
                    print(f"Error fetching metadata from URI {token_uri}: {e}")
        
        metadata = {
            "token_id": token_id,
            "token_address": checksum_address,
            "owner": owner,
            "token_uri": token_uri,
            "metadata": full_metadata
        }
        
        if debug:
            print(f"Token metadata: {metadata}")
        
        return metadata
    except Exception as e:
        if debug:
            print(f"Error getting token metadata for {contract_address}:{token_id}: {e}")
        return None

def scan_for_nft_contracts(w3, start_block, end_block, debug=False):
    """Scan for NFT contracts by checking events in a range of blocks"""
    potential_contracts = set()
    
    for block_number in range(start_block, end_block + 1, 1000):
        block_range_end = min(block_number + 999, end_block)
        
        if debug:
            print(f"Scanning blocks {block_number} to {block_range_end}...")
        
        try:
            # Look for Transfer events (common in ERC-721 tokens)
            transfer_filter = w3.eth.filter({
                'fromBlock': block_number,
                'toBlock': block_range_end,
                'topics': [
                    # Transfer event signature
                    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
                ]
            })
            
            transfer_logs = transfer_filter.get_all_entries()
            
            for log in transfer_logs:
                contract_address = log['address']
                potential_contracts.add(contract_address)
            
            if debug:
                print(f"Found {len(transfer_logs)} Transfer events")
            
        except Exception as e:
            if debug:
                print(f"Error scanning blocks {block_number} to {block_range_end}: {e}")
    
    if debug:
        print(f"Found {len(potential_contracts)} potential NFT contracts")
    
    return list(potential_contracts)

def get_all_assets(w3, debug=False, scan_blocks=False, start_block=0, end_block=None, max_ids_to_check=None, batch_size=100):
    """Get all assets from all contracts with complete metadata"""
    all_assets = []
    
    # Get the latest block number if end_block is not specified
    if end_block is None:
        end_block = get_latest_block_number(w3, debug)
        if end_block is None:
            if debug:
                print("Failed to get latest block number")
            return []
    
    # Convert all addresses to proper checksum addresses
    contracts_to_check = [Web3.to_checksum_address(addr) for addr in KNOWN_IP_ASSET_ADDRESSES]
    
    # Scan for additional NFT contracts if requested
    if scan_blocks:
        if debug:
            print(f"Scanning blocks {start_block} to {end_block} for NFT contracts...")
        
        potential_contracts = scan_for_nft_contracts(w3, start_block, end_block, debug)
        
        for contract in potential_contracts:
            checksum_contract = Web3.to_checksum_address(contract)
            if checksum_contract not in contracts_to_check:
                contracts_to_check.append(checksum_contract)
    
    # Process each contract
    for contract_address in contracts_to_check:
        if debug:
            print(f"\nProcessing contract {contract_address}...")
        
        # Get contract info
        contract_info = get_contract_info(w3, contract_address, debug)
        
        if not contract_info:
            if debug:
                print(f"Skipping contract {contract_address} - failed to get info")
            continue
        
        if debug:
            print(f"Contract {contract_address}: {contract_info['name']} ({contract_info['symbol']})")
            print(f"Total supply: {contract_info['total_supply']}")
        
        # Get token IDs
        token_ids = get_token_ids(
            w3, 
            contract_address, 
            contract_info.get('total_supply', 0), 
            debug, 
            max_ids_to_check,
            batch_size
        )
        
        if not token_ids:
            if debug:
                print(f"No tokens found for contract {contract_address}")
            continue
        
        if debug:
            print(f"Found {len(token_ids)} tokens for contract {contract_address}")
            print(f"Getting metadata for all tokens...")
        
        # Get metadata for each token
        contract_assets = []
        
        # Use ThreadPoolExecutor for parallel processing of metadata
        with ThreadPoolExecutor(max_workers=5) as executor:
            # Create a future for each token metadata fetch
            future_to_id = {
                executor.submit(get_token_metadata, w3, contract_address, token_id, debug): token_id
                for token_id in token_ids
            }
            
            # Process completed futures
            for future in as_completed(future_to_id):
                token_id = future_to_id[future]
                try:
                    metadata = future.result()
                    if metadata:
                        # Create a comprehensive asset object
                        asset = {
                            "token_id": token_id,
                            "token_address": contract_address,
                            "token_name": contract_info.get('name'),
                            "token_symbol": contract_info.get('symbol'),
                            "token_uri": metadata.get('token_uri'),
                            "owner": metadata.get('owner'),
                            "metadata": metadata.get('metadata')
                        }
                        
                        contract_assets.append(asset)
                        
                        if debug and len(contract_assets) % 10 == 0:
                            print(f"Processed {len(contract_assets)}/{len(token_ids)} tokens for {contract_info['name']}")
                except Exception as e:
                    if debug:
                        print(f"Error processing metadata for token {token_id}: {e}")
        
        if debug:
            print(f"Added {len(contract_assets)} assets for contract {contract_info['name']}")
        
        all_assets.extend(contract_assets)
    
    return all_assets

def main():
    parser = argparse.ArgumentParser(description="Fetch all assets from all contracts with complete metadata")
    parser.add_argument("--output", default="all_story_assets.json", help="Output file path")
    parser.add_argument("--pretty", action="store_true", help="Pretty print JSON output")
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    parser.add_argument("--scan-blocks", action="store_true", help="Scan blocks for NFT contracts")
    parser.add_argument("--start-block", type=int, default=0, help="Start block for scanning (default: 0)")
    parser.add_argument("--end-block", type=int, help="End block for scanning (default: latest)")
    parser.add_argument("--max-ids", type=int, default=None, help="Maximum token IDs to check per contract")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for token ID checking")
    parser.add_argument("--contract", help="Focus on a specific contract address")
    
    args = parser.parse_args()
    
    try:
        if args.debug:
            print("Connecting to Story Protocol RPC...")
        
        # Connect to RPC
        w3 = connect_to_rpc()
        
        # Check connection
        if not w3.is_connected():
            print("Failed to connect to RPC")
            return
        
        chain_id = w3.eth.chain_id
        
        if args.debug:
            print(f"Connected to chain ID: {chain_id}")
            print(f"Latest block: {w3.eth.block_number}")
        
        # If a specific contract is specified, just process that one
        if args.contract:
            if args.debug:
                print(f"Focusing on contract: {args.contract}")
            
            # Get contract info
            contract_info = get_contract_info(w3, args.contract, debug=args.debug)
            
            if not contract_info:
                print(f"Failed to get info for contract {args.contract}")
                return
            
            # Get token IDs
            token_ids = get_token_ids(
                w3, 
                args.contract, 
                contract_info.get('total_supply', 0), 
                debug=args.debug, 
                max_ids_to_check=args.max_ids,
                batch_size=args.batch_size
            )
            
            if not token_ids:
                print(f"No tokens found for contract {args.contract}")
                return
            
            # Get metadata for each token
            assets = []
            for token_id in token_ids:
                metadata = get_token_metadata(w3, args.contract, token_id, debug=args.debug)
                if metadata:
                    asset = {
                        "token_id": token_id,
                        "token_address": args.contract,
                        "token_name": contract_info.get('name'),
                        "token_symbol": contract_info.get('symbol'),
                        "token_uri": metadata.get('token_uri'),
                        "owner": metadata.get('owner'),
                        "metadata": metadata.get('metadata')
                    }
                    assets.append(asset)
            
            # Prepare output
            output = {
                "contract": contract_info,
                "assets": assets,
                "asset_count": len(assets),
                "timestamp": datetime.now().isoformat()
            }
            
            # Write output
            if args.pretty:
                json_output = json.dumps(output, indent=2)
            else:
                json_output = json.dumps(output)
            
            with open(args.output, 'w') as f:
                f.write(json_output)
            
            print(f"Found {len(assets)} assets for contract {args.contract}")
            print(f"Output written to {args.output}")
            
            return
        
        # Get all assets from all contracts
        if args.debug:
            print("Fetching all assets from all contracts...")
        
        assets = get_all_assets(
            w3,
            debug=args.debug,
            scan_blocks=args.scan_blocks,
            start_block=args.start_block,
            end_block=args.end_block,
            max_ids_to_check=args.max_ids,
            batch_size=args.batch_size
        )
        
        if not assets:
            print("No assets found")
            return
        
        # Prepare output
        output = {
            "assets": assets,
            "asset_count": len(assets),
            "chain_id": chain_id,
            "timestamp": datetime.now().isoformat()
        }
        
        # Write output
        if args.pretty:
            json_output = json.dumps(output, indent=2)
        else:
            json_output = json.dumps(output)
        
        with open(args.output, 'w') as f:
            f.write(json_output)
        
        # Print summary
        print(f"Total assets collected: {len(assets)}")
        
        # Count unique token addresses and token IDs
        token_addresses = set()
        token_ids = set()
        collections = {}
        
        for asset in assets:
            token_address = asset.get("token_address")
            token_id = asset.get("token_id")
            token_name = asset.get("token_name", "Unknown")
            
            if token_address:
                token_addresses.add(token_address)
                
                if token_address not in collections:
                    collections[token_address] = {
                        "name": token_name,
                        "count": 0
                    }
                
                collections[token_address]["count"] += 1
            
            if token_id:
                token_ids.add(f"{token_address}:{token_id}")
        
        print(f"Unique token addresses: {len(token_addresses)}")
        print(f"Unique token IDs: {len(token_ids)}")
        
        print("\nAssets by collection:")
        for token_address, info in collections.items():
            print(f"  {token_address}: {info['name']} - {info['count']} assets")
        
        print(f"\nOutput written to {args.output}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        
        if args.debug:
            import traceback
            traceback.print_exc()
        
        sys.exit(1)

if __name__ == "__main__":
    main() 