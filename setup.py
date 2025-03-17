from setuptools import setup, find_packages

setup(
    name="blacksky-md",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "twilio>=9.4.6",
        "trafilatura>=2.0.0"
    ],
    python_requires=">=3.11"
)
