import requests

url = "http://127.0.0.1:8000/scan"

file_path = r"images/image.png"
files = {"image": open(file_path, "rb")}
data = {"mode": "travel"}

print("Sending image to backend...")
response = requests.post(url, files=files, data=data)

print("Response from Backend:")
print(response.json())