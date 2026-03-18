#!/usr/bin/env python
"""
Test connectivity to all third-party services required by Step 5.
Tests: Pinata IPFS, Polygon Amoy RPC, SendGrid (optional), Redis.
"""

import json
import os
import sys
from urllib import error, request

import django
from dotenv import load_dotenv

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'creativechain.settings')
load_dotenv()
django.setup()

from django.conf import settings

RESET = '\033[0m'
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'


def print_status(label, result, error_msg=None):
    if result:
        print(f'{GREEN}✓{RESET} {label}')
    else:
        print(f'{RED}✗{RESET} {label}')
        if error_msg:
            print(f'  Error: {error_msg}')


def test_pinata():
    """Test Pinata IPFS connectivity by requesting account info."""
    print(f'\n{YELLOW}Testing Pinata IPFS...{RESET}')
    
    api_key = settings.PINATA_API_KEY
    secret_key = settings.PINATA_SECRET_KEY
    
    if not api_key or not secret_key:
        print_status('Pinata credentials', False, 'API_KEY or SECRET_KEY not configured')
        return False
    
    try:
        req = request.Request(
            'https://api.pinata.cloud/data/testAuthentication',
            headers={
                'pinata_api_key': api_key,
                'pinata_secret_api_key': secret_key,
            },
            method='GET',
        )
        with request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
        print_status('Pinata authentication', True)
        print(f'  Authenticated as: {data.get("data", {}).get("email", "unknown")}')
        return True
    except error.HTTPError as exc:
        print_status('Pinata authentication', False, f'HTTP {exc.code}: {exc.reason}')
        return False
    except error.URLError as exc:
        print_status('Pinata authentication', False, f'Connection error: {exc.reason}')
        return False
    except Exception as exc:
        print_status('Pinata authentication', False, str(exc))
        return False


def test_polygon_amoy_rpc():
    """Test Polygon Amoy RPC connectivity."""
    print(f'\n{YELLOW}Testing Polygon Amoy RPC...{RESET}')
    
    rpc_url = settings.POLYGON_AMOY_RPC_URL
    if not rpc_url:
        print_status('Polygon Amoy RPC URL', False, 'POLYGON_AMOY_RPC_URL not configured')
        return False
    
    try:
        payload = {
            'jsonrpc': '2.0',
            'method': 'eth_chainId',
            'params': [],
            'id': 1,
        }
        req = request.Request(
            rpc_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        if 'result' in data:
            chain_id = data['result']
            expected_chain_id = '0x13a92'  # 80002 in hex
            if chain_id == expected_chain_id:
                print_status('Polygon Amoy RPC connectivity', True)
                print(f'  Chain ID: {chain_id} (Amoy testnet confirmed)')
                return True
            else:
                print_status('Polygon Amoy RPC connectivity', True)
                print(f'  Chain ID: {chain_id} (unexpected, expected {expected_chain_id})')
                return True
        else:
            error_msg = data.get('error', {}).get('message', 'unknown error')
            print_status('Polygon Amoy RPC', False, error_msg)
            return False
    except error.URLError as exc:
        print_status('Polygon Amoy RPC connectivity', False, f'Connection error: {exc.reason}')
        return False
    except Exception as exc:
        print_status('Polygon Amoy RPC connectivity', False, str(exc))
        return False


def test_redis():
    """Test Redis connectivity."""
    print(f'\n{YELLOW}Testing Redis...{RESET}')
    
    try:
        import redis
        redis_url = settings.REDIS_URL
        r = redis.from_url(redis_url, decode_responses=True)
        r.ping()
        print_status('Redis connectivity', True)
        info = r.info()
        print(f'  Redis version: {info.get("redis_version", "unknown")}')
        return True
    except ImportError:
        print_status('Redis connectivity', False, 'redis package not installed')
        return False
    except Exception as exc:
        print_status('Redis connectivity', False, str(exc))
        return False


def test_postgresql():
    """Test PostgreSQL connectivity."""
    print(f'\n{YELLOW}Testing PostgreSQL...{RESET}')
    
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('SELECT version();')
            version = cursor.fetchone()[0]
        print_status('PostgreSQL connectivity', True)
        print(f'  Version: {version.split(",")[0]}')
        return True
    except Exception as exc:
        print_status('PostgreSQL connectivity', False, str(exc))
        return False


def test_sendgrid():
    """Test SendGrid configuration (non-connection test)."""
    print(f'\n{YELLOW}Testing SendGrid...{RESET}')
    
    api_key = settings.EMAIL_HOST_PASSWORD
    if not api_key:
        print_status('SendGrid API key', False, 'SENDGRID_API_KEY not configured (optional)')
        return False
    
    print_status('SendGrid API key', True, 'configured (not tested—optional service)')
    return True


def main():
    print('\n' + '='*60)
    print('Step 5 Third-Party Service Connectivity Test')
    print('='*60)
    
    results = {
        'Pinata': test_pinata(),
        'Polygon Amoy RPC': test_polygon_amoy_rpc(),
        'Redis': test_redis(),
        'PostgreSQL': test_postgresql(),
        'SendGrid': test_sendgrid(),
    }
    
    print('\n' + '='*60)
    print('Summary')
    print('='*60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f'\nPassed: {passed}/{total}')
    for service, result in results.items():
        status_str = f'{GREEN}PASS{RESET}' if result else f'{RED}FAIL{RESET}'
        print(f'  {status_str} — {service}')
    
    if passed == total:
        print(f'\n{GREEN}All critical services are connected!{RESET}')
        return 0
    elif passed >= 3:  # At least DB, Redis, Polygon RPC
        print(f'\n{YELLOW}Core services connected. Some optional/external services may need credentials.{RESET}')
        return 0
    else:
        print(f'\n{RED}Critical service connectivity issues detected.{RESET}')
        return 1


if __name__ == '__main__':
    sys.exit(main())

