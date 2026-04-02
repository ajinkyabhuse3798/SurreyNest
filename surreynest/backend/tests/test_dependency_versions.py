from importlib import import_module

from packaging.version import Version


def _module_version(module_name: str, attr_name: str = "__version__") -> Version:
    module = import_module(module_name)
    return Version(getattr(module, attr_name))


def test_security_sensitive_dependencies_meet_minimum_safe_versions():
    minimums = {
        "fastapi": Version("0.120.4"),
        "starlette": Version("0.49.1"),
        "requests": Version("2.33.1"),
        "sklearn": Version("1.5.2"),
        "multipart": Version("0.0.22"),
        "jose": Version("3.5.0"),
    }

    installed = {
        "fastapi": _module_version("fastapi"),
        "starlette": _module_version("starlette"),
        "requests": _module_version("requests"),
        "sklearn": _module_version("sklearn"),
        "multipart": _module_version("python_multipart"),
        "jose": _module_version("jose"),
    }

    failures = {
        name: {"installed": str(installed[name]), "minimum": str(minimum)}
        for name, minimum in minimums.items()
        if installed[name] < minimum
    }

    assert failures == {}, failures
