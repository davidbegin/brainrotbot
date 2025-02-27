#!/usr/bin/env python3
# get_story_assets.py - A simplified script to get comprehensive information about all Story Protocol assets

import json
import argparse
import sys
import requests
from datetime import datetime
from collections import Counter
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# StoryScan API endpoint
STORYSCAN_API_ENDPOINT = "https://aeneid.storyscan.xyz/api/v2"

def get_token_transfers(limit=100, page_key=None):
    """Get recent token transfers from the Story Protocol blockchain"""
    url = f"{STORYSCAN_API_ENDPOINT}/token-transfers"
    params = {"limit": limit}
    
    if page_key:
        params["page_key"] = page_key
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    return response.json()

def get_token_info(token_address):
    """Get information about a token by its address"""
    url = f"{STORYSCAN_API_ENDPOINT}/tokens/{token_address}"
    
    response = requests.get(url)
    response.raise_for_status()
    
    return response.json()

def get_token_instance(token_address, token_id):
    """Get information about a specific token instance"""
    url = f"{STORYSCAN_API_ENDPOINT}/tokens/{token_address}/instances/{token_id}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error getting token instance {token_address}:{token_id}: {e}")
        return None

def get_all_tokens(limit=100, page_key=None):
    """Get all tokens from the Story Protocol blockchain"""
    url = f"{STORYSCAN_API_ENDPOINT}/tokens"
    params = {"limit": limit}
    
    if page_key:
        params["page_key"] = page_key
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    return response.json()

def extract_token_ids_from_transfers(max_pages=10, debug=False):
    """Extract token IDs from recent transfers with pagination"""
    token_ids_map = {}
    page_key = None
    page_count = 0
    
    while page_count < max_pages:
        if debug:
            print(f"Fetching token transfers page {page_count + 1}...")
        
        transfers_data = get_token_transfers(limit=100, page_key=page_key)
        
        if "items" not in transfers_data or not transfers_data["items"]:
            break
        
        for item in transfers_data["items"]:
            token = item.get("token")
            token_id = item.get("total", {}).get("token_id")
            
            if token and token_id and token.get("type") == "ERC-721":
                token_address = token.get("address")
                
                if token_address not in token_ids_map:
                    token_ids_map[token_address] = {
                        "name": token.get("name"),
                        "symbol": token.get("symbol"),
                        "type": token.get("type"),
                        "total_supply": token.get("total_supply"),
                        "holders": token.get("holders"),
                        "token_ids": []
                    }
                
                if token_id not in token_ids_map[token_address]["token_ids"]:
                    token_ids_map[token_address]["token_ids"].append(token_id)
        
        # Check if there's a next page
        page_key = transfers_data.get("next_page_params", {}).get("page_key")
        if not page_key:
            break
        
        page_count += 1
    
    if debug:
        print(f"Processed {page_count + 1} pages of token transfers")
    
    return token_ids_map

def get_all_token_contracts(max_pages=10, debug=False):
    """Get all ERC-721 token contracts with pagination"""
    erc721_tokens = []
    page_key = None
    page_count = 0
    
    while page_count < max_pages:
        if debug:
            print(f"Fetching tokens page {page_count + 1}...")
        
        tokens_data = get_all_tokens(limit=100, page_key=page_key)
        
        if "items" not in tokens_data or not tokens_data["items"]:
            break
        
        # Extract ERC-721 tokens
        for token in tokens_data["items"]:
            if token.get("type") == "ERC-721":
                erc721_tokens.append(token)
        
        # Check if there's a next page
        page_key = tokens_data.get("next_page_params", {}).get("page_key")
        if not page_key:
            break
        
        page_count += 1
    
    if debug:
        print(f"Processed {page_count + 1} pages of tokens")
        print(f"Found {len(erc721_tokens)} ERC-721 tokens")
    
    return erc721_tokens

def get_token_instances_with_pagination(token_address, max_pages=10, debug=False):
    """Get token instances for a specific token with pagination"""
    instances = []
    page_key = None
    page_count = 0
    
    while page_count < max_pages:
        if debug and page_count == 0:
            print(f"Fetching instances for token {token_address}...")
        elif debug:
            print(f"Fetching instances page {page_count + 1} for token {token_address}...")
        
        url = f"{STORYSCAN_API_ENDPOINT}/tokens/{token_address}/instances"
        params = {"limit": 100}
        
        if page_key:
            params["page_key"] = page_key
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if "items" not in data or not data["items"]:
                if debug:
                    print(f"No items found in response for token {token_address}")
                break
            
            # Process each item
            for item in data["items"]:
                if item is None:
                    continue
                
                token_id = item.get("token_id")
                if token_id:
                    instance_data = {
                        "token_id": token_id,
                        "metadata": item.get("metadata"),
                        "image_url": item.get("image_url"),
                        "animation_url": item.get("animation_url"),
                        "owner": item.get("owner", {}).get("hash") if item.get("owner") else None
                    }
                    instances.append(instance_data)
            
            # Check if there's a next page
            page_key = data.get("next_page_params", {}).get("page_key") if data.get("next_page_params") else None
            if not page_key:
                break
            
            page_count += 1
        except Exception as e:
            if debug:
                print(f"Error fetching instances for token {token_address}: {e}")
            break
    
    if debug:
        print(f"Found {len(instances)} instances with token IDs for token {token_address}")
    
    return instances

def get_asset_details(token_address, token_id, token_info=None):
    """Get detailed information about a specific asset"""
    # Get token instance
    instance = get_token_instance(token_address, token_id)
    
    if not instance:
        return None
    
    # Get token information if not provided
    if not token_info:
        token_info = get_token_info(token_address)
    
    # Combine information
    details = {
        "token_id": token_id,
        "token_address": token_address,
        "token_name": token_info.get("name") if token_info else None,
        "token_symbol": token_info.get("symbol") if token_info else None,
        "token_type": token_info.get("type") if token_info else None,
        "total_supply": token_info.get("total_supply") if token_info else None,
        "holders": token_info.get("holders") if token_info else None,
        "metadata": instance.get("metadata"),
        "image_url": instance.get("image_url"),
        "animation_url": instance.get("animation_url"),
        "owner": instance.get("owner", {}).get("hash") if instance.get("owner") else None
    }
    
    return details

def collect_all_assets(debug=False, max_transfer_pages=10, max_token_pages=10, max_instance_pages=5):
    """Collect all assets from the Story Protocol blockchain"""
    if debug:
        print("Extracting token IDs from transfers...")
    
    # Get token IDs from transfers
    token_ids_map = extract_token_ids_from_transfers(max_pages=max_transfer_pages, debug=debug)
    
    if debug:
        print(f"Found {len(token_ids_map)} token contracts with token IDs from transfers")
        for token_address, info in token_ids_map.items():
            print(f"  {token_address} ({info['name']}): {len(info['token_ids'])} token IDs")
    
    # Get all ERC-721 token contracts
    if debug:
        print("Getting all ERC-721 token contracts...")
    
    erc721_tokens = get_all_token_contracts(max_pages=max_token_pages, debug=debug)
    
    # Collect all assets
    all_assets = []
    null_fields_counter = Counter()
    
    # First, process tokens with known token IDs from transfers
    for token_address, info in token_ids_map.items():
        if debug:
            print(f"Collecting assets for token {token_address} ({info['name']})...")
        
        token_info = {
            "name": info["name"],
            "symbol": info["symbol"],
            "type": info["type"],
            "total_supply": info["total_supply"],
            "holders": info["holders"]
        }
        
        for token_id in info["token_ids"]:
            if debug:
                print(f"  Getting details for token {token_address}:{token_id}...")
            
            asset = get_asset_details(token_address, token_id, token_info)
            
            if asset:
                # Count null fields
                for key, value in asset.items():
                    if value is None:
                        null_fields_counter[key] += 1
                
                all_assets.append(asset)
                
                if debug:
                    print(f"  Added asset {token_address}:{token_id}")
            else:
                if debug:
                    print(f"  Failed to get details for token {token_address}:{token_id}")
    
    # Then, process all ERC-721 tokens and get their instances
    processed_tokens = set(token_ids_map.keys())
    
    for token in erc721_tokens:
        token_address = token.get("address")
        
        # Skip tokens we've already processed
        if token_address in processed_tokens:
            if debug:
                print(f"Skipping token {token_address} ({token.get('name')}) - already processed")
            continue
        
        processed_tokens.add(token_address)
        
        if debug:
            print(f"Collecting instances for token {token_address} ({token.get('name')})...")
        
        instances = get_token_instances_with_pagination(token_address, max_pages=max_instance_pages, debug=debug)
        
        if debug:
            print(f"Processing {len(instances)} instances for token {token_address}")
        
        for instance in instances:
            token_id = instance.get("token_id")
            
            if not token_id:
                if debug:
                    print(f"  Skipping instance without token ID for token {token_address}")
                continue
            
            # Create a clean IP asset object
            ip_asset = {
                "token_id": token_id,
                "token_address": token_address,
                "token_name": token.get("name"),
                "token_symbol": token.get("symbol"),
                "token_type": token.get("type"),
                "total_supply": token.get("total_supply"),
                "holders": token.get("holders"),
                "metadata": instance.get("metadata"),
                "image_url": instance.get("image_url"),
                "animation_url": instance.get("animation_url"),
                "owner": instance.get("owner"),
                "source": "token_instances_pagination"
            }
            
            # Count null fields
            for key, value in ip_asset.items():
                if value is None:
                    null_fields_counter[key] += 1
            
            all_assets.append(ip_asset)
            
            if debug:
                print(f"  Added asset {token_address}:{token_id}")
    
    if debug:
        print(f"Total assets collected: {len(all_assets)}")
    
    return all_assets, null_fields_counter

def main():
    parser = argparse.ArgumentParser(description="Get Story Protocol assets")
    parser.add_argument("--output", default="story_assets.json", help="Output file path")
    parser.add_argument("--pretty", action="store_true", help="Pretty print JSON output")
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    parser.add_argument("--token-address", help="Specific token address to query")
    parser.add_argument("--token-id", help="Specific token ID to query (requires --token-address)")
    parser.add_argument("--max-transfer-pages", type=int, default=20, help="Maximum number of transfer pages to fetch")
    parser.add_argument("--max-token-pages", type=int, default=20, help="Maximum number of token pages to fetch")
    parser.add_argument("--max-instance-pages", type=int, default=10, help="Maximum number of instance pages to fetch per token")
    args = parser.parse_args()
    
    # Configure requests to retry on failure
    retry_strategy = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    
    # Use the session for all requests
    requests.get = session.get
    
    if args.token_address and args.token_id:
        # Get details for a specific token
        if args.debug:
            print(f"Getting details for token {args.token_address}:{args.token_id}...")
        
        token_info = get_token_info(args.token_address)
        asset = get_asset_details(args.token_address, args.token_id, token_info)
        
        if asset:
            if args.pretty:
                json_str = json.dumps(asset, indent=2)
            else:
                json_str = json.dumps(asset)
            
            with open(args.output, "w") as f:
                f.write(json_str)
            
            print(f"Asset details saved to {args.output}")
        else:
            print(f"Failed to get details for token {args.token_address}:{args.token_id}")
    else:
        # Collect all assets
        if args.debug:
            print("Collecting all assets...")
            print(f"Using max_transfer_pages={args.max_transfer_pages}, max_token_pages={args.max_token_pages}, max_instance_pages={args.max_instance_pages}")
        
        assets, null_fields = collect_all_assets(
            debug=args.debug, 
            max_transfer_pages=args.max_transfer_pages,
            max_token_pages=args.max_token_pages,
            max_instance_pages=args.max_instance_pages
        )
        
        # Summarize the results
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
        
        print(f"Total assets collected: {len(assets)}")
        print(f"Unique token addresses: {len(token_addresses)}")
        print(f"Unique token IDs: {len(token_ids)}")
        
        print("\nAssets by collection:")
        for token_address, info in collections.items():
            print(f"  {token_address} ({info['name']}): {info['count']} assets")
        
        print("\nNull fields summary:")
        for field, count in null_fields.items():
            print(f"  {field}: {count} assets ({count / len(assets) * 100:.1f}%)")
        
        # Save the results
        if args.pretty:
            json_str = json.dumps(assets, indent=2)
        else:
            json_str = json.dumps(assets)
        
        with open(args.output, "w") as f:
            f.write(json_str)
        
        print(f"\nAssets saved to {args.output}")

if __name__ == "__main__":
    main()
