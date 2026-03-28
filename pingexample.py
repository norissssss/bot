from discord.ext import commands
from discord import app_commands

class Ping(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="ping", description="Ping command")
    async def ping(self, interaction):
        await interaction.response.send_message("🏓 Pong!")

async def setup(bot):
    await bot.add_cog(Ping(bot))
