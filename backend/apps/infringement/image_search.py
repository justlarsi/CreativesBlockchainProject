"""Image search service for finding similar images across the web."""
import logging
from typing import Any, Optional
from urllib.parse import quote_plus

import requests

logger = logging.getLogger(__name__)

# Google Images search URL (using a reverse-engineered approach)
GOOGLE_IMAGES_SEARCH_URL = 'https://www.google.com/search'
# Bing Images search URL
BING_IMAGES_SEARCH_URL = 'https://www.bing.com/images/search'


def search_google_images(query: str, max_results: int = 10) -> list[dict[str, Any]]:
    """
    Search for images on Google Images using a query string.
    
    Args:
        query: Search query (typically work title + description)
        max_results: Maximum number of results to return
        
    Returns:
        List of dictionaries with image data (url, title, source)
    """
    try:
        # Use a simple approach with Google Images
        # This is a best-effort implementation using the public search interface
        params = {
            'q': query,
            'tbm': 'isch',  # Images search
            'ijn': '0',
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(
            GOOGLE_IMAGES_SEARCH_URL,
            params=params,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
        
        # Extract image URLs from the response HTML
        # This is a basic implementation - Google may change their structure
        results = []
        
        # Parse the response for image data
        # Note: Google's structure is complex; this is a fallback approach
        if 'images' in response.text.lower():
            # Simplified extraction - in production, use a proper parser
            import re
            image_pattern = r'"imgUrl":"([^"]+)"'
            matches = re.findall(image_pattern, response.text)
            
            for url in matches[:max_results]:
                if url and url.startswith('http'):
                    results.append({
                        'source_url': url,
                        'title': query,
                        'source_platform': 'google_images',
                        'description': f'Similar image for "{query}"',
                    })
        
        logger.info(f'search_google_images: found {len(results)} images for query "{query}"')
        return results
        
    except Exception as exc:
        logger.error(f'search_google_images: failed for query "{query}": {exc}')
        return []


def search_bing_images(query: str, max_results: int = 10) -> list[dict[str, Any]]:
    """
    Search for images on Bing using the public search API.
    
    Args:
        query: Search query (typically work title + description)
        max_results: Maximum number of results to return
        
    Returns:
        List of dictionaries with image data (url, title, source)
    """
    try:
        params = {
            'q': query,
            'fl': 'a',
            'sc': '0-0',
            'qft': '',
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(
            BING_IMAGES_SEARCH_URL,
            params=params,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
        
        # Extract image URLs from Bing response
        results = []
        
        # Parse response for mImg data
        import re
        image_pattern = r'"mImg":{"src":"([^"]+)"'
        matches = re.findall(image_pattern, response.text)
        
        for url in matches[:max_results]:
            if url and (url.startswith('http') or url.startswith('//')):
                if url.startswith('//'):
                    url = 'https:' + url
                results.append({
                    'source_url': url,
                    'title': query,
                    'source_platform': 'bing_images',
                    'description': f'Similar image for "{query}"',
                })
        
        logger.info(f'search_bing_images: found {len(results)} images for query "{query}"')
        return results
        
    except Exception as exc:
        logger.error(f'search_bing_images: failed for query "{query}": {exc}')
        return []


def search_images_for_work(work_title: str, work_description: str = '', max_results: int = 15) -> list[dict[str, Any]]:
    """
    Search for similar images for a creative work.
    
    Combines title and description into a query and searches multiple sources.
    
    Args:
        work_title: Title of the creative work
        work_description: Description of the work (optional)
        max_results: Maximum number of results to return
        
    Returns:
        List of image search results with source URLs and metadata
    """
    # Build search query
    query = work_title
    if work_description:
        # Add description but limit length to avoid extremely long queries
        desc_preview = work_description[:100]
        query = f'{work_title} {desc_preview}'
    
    logger.info(f'search_images_for_work: searching for "{query}"')
    
    # Try Bing first (more reliable), then Google as fallback
    results = search_bing_images(query, max_results=max_results)
    
    # If Bing results are limited, try Google
    if len(results) < max_results // 2:
        google_results = search_google_images(query, max_results=max_results - len(results))
        results.extend(google_results)
    
    return results[:max_results]
