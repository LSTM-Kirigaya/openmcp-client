import requests
from pydantic import BaseModel
from typing import Optional, List
from mcp.server.fastmcp import FastMCP
from bs4 import BeautifulSoup
import json


from urllib import parse
import argparse
import os
import shutil
import uuid
import time
from threading import Thread
from typing import List


from bs4 import BeautifulSoup
import requests

class ImageResult(BaseModel):
    url: str
    title: str
    source: str

class BingImage:
    path = 'https://cn.bing.com/images/search'
    block_num = 35
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36"
    }

def bing_crawler(key_word: str, image_num: int) -> Optional[List[ImageResult]]:
    query = {
        'q': key_word,
        'count': image_num
    }
    
    url = BingImage.path + '?' + parse.urlencode(query)
    res = requests.get(url, headers=BingImage.headers)

    soup = BeautifulSoup(res.content, "html.parser")
    results = []
    for a in soup.select('.iusc'):
        href = a.attrs['href']
        decode_href = parse.unquote(href)
        media_url = decode_href.split('&')[4][9:]
        title = a.get('alt', '')
        
        results.append(ImageResult(
            url=media_url,
            title=title,
            source="bing"
        ))
        if len(results) >= image_num:
            break
    
    return results if results else None

mcp = FastMCP('image_crawler', version="0.0.1")

@mcp.tool(
    name='image_crawler',
    description='根据关键词从指定搜索引擎爬取图片'
)
def image_crawler_tool(key_word: str, image_num: int) -> str:
    """图片爬取工具，返回格式化字符串"""
    images = bing_crawler(key_word, image_num)
    return str(images)

if __name__ == "__main__":
    images = bing_crawler("明日方舟 m3", 5)
    print(images)