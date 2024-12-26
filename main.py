from wcferry import Wcf
from datetime import datetime
import logging
import time
from queue import Empty
import os
import sys

# 获取用户数据目录
app_data = os.getenv('APPDATA')
app_dir = os.path.join(app_data, 'new-boy')
log_dir = os.path.join(app_dir, 'logs')

# 创建日志目录
os.makedirs(log_dir, exist_ok=True)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',  # 简化日志格式，只显示消息内容
    handlers=[
        logging.FileHandler(os.path.join(log_dir, 'robot.log'), encoding='utf-8'),
        logging.StreamHandler()
    ]
)

def get_msg_type(type_id):
    """将消息类型ID转换为可读的中文描述"""
    msg_types = {
        1: "文本消息",
        3: "图片消息",
        34: "语音消息",
        43: "视频消息",
        47: "表情消息",
        49: "应用消息",
        10000: "系统消息"
    }
    return msg_types.get(type_id, f"未知类型({type_id})")

def print_login_info(wcf):
    """打印登录账号信息"""
    logging.info("\n" + "="*50)
    logging.info("登录账号信息：")
    
    # 获取个人信息
    wxid = wcf.get_self_wxid()
    user_info = wcf.get_user_info()
    logging.info(f"微信号: {wxid}")
    logging.info(f"昵称: {user_info.get('name', '未知')}")
    logging.info(f"备注: {user_info.get('remark', '未知')}")
    
    # 获取好友数量
    friends = wcf.get_friends()
    logging.info(f"好友数量: {len(friends) if friends else 0}")
    
    logging.info("="*50 + "\n")

def main():
    try:
        # 初始化 wcferry
        wcf = Wcf()
        
        # 确保微信已登录
        if not wcf.is_login():
            logging.error("请先登录微信")
            return
        
        # 检查消息接收状态
        if not wcf.is_receiving_msg():
            logging.info("启用消息接收功能...")
            wcf.enable_receiving_msg()
        
        # 打印登录账号信息
        print_login_info(wcf)
        
        logging.info("机器人已启动，等待消息...")
        
        while True:
            try:
                # 获取消息
                msg = wcf.get_msg()
                
                if msg:
                    # 获取当前时间
                    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    
                    # 打印消息详情
                    logging.info("\n" + "="*50)
                    logging.info("收到新消息:")
                    logging.info(f"时间: {current_time}")
                    logging.info(f"发送者: {msg.sender}")
                    logging.info(f"消息类型: {get_msg_type(msg.type)}")
                    logging.info(f"消息内容: {msg.content}")
                    
                    # 判断是否为群消息
                    if '@chatroom' in msg.sender:
                        room_name = wcf.get_room_name(msg.sender)
                        sender_name = wcf.get_room_member_nickname(msg.sender, msg.roomid)
                        logging.info(f"群名称: {room_name}")
                        logging.info(f"发送者昵称: {sender_name}")
                    
                    logging.info("="*50 + "\n")
                
            except Empty:
                time.sleep(0.5)
                continue
                
            except KeyboardInterrupt:
                logging.info("程序已停止")
                break
                
            except Exception as e:
                logging.error(f"发生错误: {str(e)}")
                time.sleep(1)
                continue
    except Exception as e:
        logging.error(f"程序启动失败: {str(e)}")
        raise

if __name__ == "__main__":
    main()