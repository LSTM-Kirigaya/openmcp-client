from mcp.server.fastmcp import FastMCP

mcp = FastMCP('锦恢的 MCP Server', version="11.45.14")

@mcp.tool(
    name='add',
    description='对两个数字进行实数域的加法'
)
def add(a: int, b: int) -> int:
    return a + b

@mcp.resource(
    uri="greeting://{name}",
    name='greeting',
    description='用于演示的一个资源协议'
)
def get_greeting(name: str) -> str:
    # 访问处理 greeting://{name} 资源访问协议，然后返回
    # 此处方便起见，直接返回一个 Hello，balabala 了
    return f"Hello, {name}!"

@mcp.prompt(
    name='translate',
    description='进行翻译的prompt'
)
def translate(message: str) -> str:
    return f'请将下面的话语翻译成中文：\n\n{message}'

@mcp.tool(
    name='multiply',
    description='对两个数字进行实数域的乘法运算'
)
def multiply(a: float, b: float) -> float:
    """返回 a 和 b 的乘积"""
    return a * b

@mcp.tool(
    name='is_even',
    description='判断一个整数是否为偶数'
)
def is_even(number: int) -> bool:
    """返回 True 如果数字是偶数，否则 False"""
    return number % 2 == 0

@mcp.tool(
    name='capitalize',
    description='将字符串首字母大写'
)
def capitalize(text: str) -> str:
    """返回首字母大写的字符串"""
    return text.capitalize()

@mcp.resource(
    uri="weather://{city}",
    name='weather',
    description='获取指定城市的天气信息'
)
def get_weather(city: str) -> str:
    """模拟天气查询协议，返回格式化字符串"""
    return f"Weather in {city}: Sunny, 25°C"

@mcp.resource(
    uri="user://{user_id}",
    name='user_profile',
    description='获取用户基本信息'
)
def get_user_profile(user_id: str) -> dict:
    """模拟用户协议，返回字典数据"""
    return {
        "id": user_id,
        "name": "张三",
        "role": "developer"
    }

@mcp.resource(
    uri="book://{isbn}",
    name='book_info',
    description='通过ISBN查询书籍信息'
)
def get_book_info(isbn: str) -> dict:
    """模拟书籍协议，返回结构化数据"""
    return {
        "isbn": isbn,
        "title": "Python编程：从入门到实践",
        "author": "Eric Matthes"
    }

@mcp.prompt(
    name='summarize',
    description='生成文本摘要的提示词模板'
)
def summarize(text: str) -> str:
    """返回摘要生成提示词"""
    return f"请用一句话总结以下内容：\n\n{text}"

@mcp.prompt(
    name='code_explanation',
    description='解释代码功能的提示词模板'
)
def explain_code(code: str) -> str:
    """返回代码解释提示词"""
    return f"请解释以下代码的功能：\n```python\n{code}\n```"

@mcp.prompt(
    name='email_generator',
    description='生成正式邮件的提示词模板'
)
def generate_email(context: str) -> str:
    """返回邮件生成提示词"""
    return (
        "根据以下需求撰写一封正式邮件：\n"
        f"需求描述：{context}\n"
        "要求：使用礼貌用语，长度不超过200字"
    )



import requests
import json
from typing import NamedTuple, Optional

class CityWeather(NamedTuple):
    city_name_en: str
    city_name_cn: str
    city_code: str
    temp: str
    wd: str
    ws: str
    sd: str
    aqi: str
    weather: str

def get_city_weather_by_city_name(city_code: str) -> Optional[CityWeather]:
    """根据城市名获取天气信息"""
    
    if not city_code:
        print(f"找不到{city_code}对应的城市")
        return None
    
    try:
        # 构造请求URL
        url = f"http://d1.weather.com.cn/sk_2d/{city_code}.html"
        
        # 设置请求头
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.0.0",
            "Host": "d1.weather.com.cn",
            "Referer": "http://www.weather.com.cn/"
        }
        
        # 发送HTTP请求
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # 解析JSON数据
        # 解析JSON数据前先处理编码问题
        content = response.text.encode('latin1').decode('unicode_escape')
        json_start = content.find("{")
        json_str = content[json_start:]
        
        weather_data = json.loads(json_str)
        
        # 构造返回对象
        return CityWeather(
            city_name_en=weather_data.get("nameen", ""),
            city_name_cn=weather_data.get("cityname", "").encode('latin1').decode('utf-8'),
            city_code=weather_data.get("city", ""),
            temp=weather_data.get("temp", ""),
            wd=weather_data.get("wd", "").encode('latin1').decode('utf-8'),
            ws=weather_data.get("ws", "").encode('latin1').decode('utf-8'),
            sd=weather_data.get("sd", ""),
            aqi=weather_data.get("aqi", ""),
            weather=weather_data.get("weather", "").encode('latin1').decode('utf-8')
        )
        
    except Exception as e:
        print(f"获取天气信息失败: {str(e)}")
        return None

@mcp.tool(
    name='get_weather_by_city_code',
    description='根据城市天气预报的城市编码 (int)，获取指定城市的天气信息'
)
def get_weather_by_code(city_code: int) -> str:
    """模拟天气查询协议，返回格式化字符串"""
    city_weather = get_city_weather_by_city_name(city_code)
    return str(city_weather)
