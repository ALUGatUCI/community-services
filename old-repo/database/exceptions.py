class AccountNotFoundError(Exception):
    def __init__(self, email: str):
        self._email = email

    def __str__(self):
        return f"An account with the email {self._email} was not found"

class InvalidPasswordError(Exception):
    def __str__(self):
        return f"The password you provided is incorrect"

class AccountBannedError(Exception):
    def __str__(self):
        return f"The account you are trying to log into is banned"