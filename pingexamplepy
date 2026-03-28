from discord.ext import commands
from discord import app_commands

class Ping(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="ping", description="Check bot latency")
    async def ping(self, interaction):
        await interaction.response.send_message("🏓 Pong!")

    @app_commands.command(name="ping_ms", description="Latency in ms")
    async def ping_ms(self, interaction):
        latency = round(self.bot.latency * 1000)
        await interaction.response.send_message(f"🏓 {latency}ms")

async def setup(bot):
    await bot.add_cog(Ping(bot))
