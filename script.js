document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // !!! IMPORTANT: REPLACE 'YOUR_MEDIASTACK_ACCESS_KEY' WITH YOUR ACTUAL KEY !!!
    // !!! DO NOT COMMIT YOUR ACTUAL KEY TO A PUBLIC REPOSITORY             !!!
    const MEDIASTACK_ACCESS_KEY = '460cfeaac0fb7c49db0660776deeb5f9'; // <--- REPLACE THIS
    // NOTE: Free Mediastack plan uses HTTP. Browsers might block this on HTTPS sites (mixed content).
    const MEDIASTACK_BASE_URL = 'http://api.mediastack.com/v1/news';

    // --- DOM Elements ---
    const countrySelect = document.getElementById('country-select');
    const categorySelect = document.getElementById('category-select');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const newsContainer = document.getElementById('news-container');
    const statusMessage = document.getElementById('status-message');

    // --- Event Listeners ---
    countrySelect.addEventListener('change', fetchNewsBasedOnFilters);
    categorySelect.addEventListener('change', fetchNewsBasedOnFilters);
    searchButton.addEventListener('click', fetchNewsBasedOnFilters); // Both filters and search use the same fetch trigger now
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            fetchNewsBasedOnFilters();
        }
    });

    // --- Functions ---

    // Function to build the Mediastack API URL
    function buildApiUrl() {
        if (MEDIASTACK_ACCESS_KEY === 'YOUR_MEDIASTACK_ACCESS_KEY' || !MEDIASTACK_ACCESS_KEY) {
             displayError("Error: API Key not set. Please add your Mediastack access key in script.js.");
             return null; // Return null to indicate failure
        }

        const params = new URLSearchParams({
            access_key: MEDIASTACK_ACCESS_KEY,
            languages: 'en', // Fetch English news primarily
            limit: 50, // Number of results
            sort: 'published_desc' // Sort by newest first
        });

        const query = searchInput.value.trim();
        const country = countrySelect.value || ''; // Use selected country or none
        const category = categorySelect.value || ''; // Use selected category or none

        if (query) {
            params.append('keywords', query);
            // Mediastack searches keywords globally, country/category might filter further if needed
            // but let's prioritize keyword search if present.
            if (country) params.append('countries', country);
            if (category) params.append('categories', category);
        } else {
            // No search query, use filters
            if (country) params.append('countries', country);
            // Use hyphen for 'general' as per Mediastack docs, or map if needed
            if (category) params.append('categories', category === 'general' ? '-' : category);
        }

        return `${MEDIASTACK_BASE_URL}?${params.toString()}`;
    }


    // Main function to fetch news
    async function fetchNews(url) {
        if (!url) return; // Don't fetch if URL building failed (e.g., no API key)

        setStatus('Fetching news...');
        newsContainer.innerHTML = ''; // Clear previous results

        try {
            const response = await fetch(url);

            // Check if the response is successful (status code 200-299)
            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    // Attempt to parse error details from Mediastack response
                    const errorData = await response.json();
                    if (errorData.error && errorData.error.message) {
                         errorMsg = `API Error (${errorData.error.code}): ${errorData.error.message}`;
                    } else if (errorData.error && errorData.error.type) {
                         errorMsg = `API Error (${errorData.error.code}): ${errorData.error.type}`;
                    }
                } catch (parseError) {
                     // Ignore if error response isn't valid JSON
                     console.warn("Could not parse error response body.");
                }
                 throw new Error(errorMsg);
            }

            const data = await response.json();

             // Mediastack response structure usually has a 'data' array
             if (data.data && data.data.length > 0) {
                displayNews(data.data); // Pass the 'data' array
                setStatus(`Showing ${data.data.length} articles.`);
            } else {
                displayNoResults();
            }

        } catch (error) {
            console.error("Error fetching news:", error);
            // Provide more user-friendly error messages for common issues
            let displayMsg = `Failed to fetch news.`;
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                 displayMsg += ' Please check your network connection.';
                 if (MEDIASTACK_BASE_URL.startsWith('http://')) {
                     displayMsg += ' Also check if your browser is blocking HTTP requests on this HTTPS page (mixed content).';
                 }
            } else if (error.message.includes('401') || error.message.includes('invalid_access_key')) {
                 displayMsg += ' Invalid API Key provided.';
            } else if (error.message.includes('429') || error.message.includes('usage_limit_reached')) {
                 displayMsg += ' API usage limit reached.';
            } else {
                 displayMsg += ` Details: ${error.message}`;
            }
            displayError(displayMsg);
        }
    }

    // Function to display news articles (UPDATED for Mediastack fields)
    function displayNews(articles) {
        newsContainer.innerHTML = ''; // Clear loading/error messages
        articles.forEach(article => {
            // --- Basic data validation ---
            if (!article.title || !article.url) {
                return; // Skip articles with no title or link
            }

            const card = document.createElement('article');
            card.classList.add('news-card');

            // Image handling (Mediastack uses 'image')
            let imageElement;
            if (article.image) {
                 // Basic check for potentially invalid image URLs sometimes returned
                 if (article.image.startsWith('http')) {
                    imageElement = `<img src="${article.image}" alt="${article.title || 'News image'}" loading="lazy" onerror="this.parentElement.style.display='none';">`; // Hide card if image fails
                 } else {
                    imageElement = `<div class="placeholder img-placeholder">Invalid Image URL</div>`;
                 }
            } else {
                 imageElement = `<div class="placeholder img-placeholder">No Image Available</div>`;
            }

             // Description handling
             const description = article.description || 'No description available.';

             // Source handling (Mediastack uses 'source')
             const sourceName = article.source || 'Unknown Source';

            // Date formatting (Mediastack uses 'published_at')
             let publishedDate = 'Date Unknown';
             try {
                 if (article.published_at) {
                    publishedDate = new Date(article.published_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                    });
                 }
             } catch(e) { console.warn("Could not parse date:", article.published_at); }


            card.innerHTML = `
                <a href="${article.url}" target="_blank" rel="noopener noreferrer">
                    ${imageElement}
                    <div class="news-content">
                        <h2>${article.title}</h2>
                        <p>${description}</p>
                        <div class="news-meta">
                            <span class="source">${sourceName}</span>
                            <span class="date">${publishedDate}</span>
                        </div>
                    </div>
                </a>
            `;
            newsContainer.appendChild(card);
        });
    }

    // Function to display error messages (No changes needed)
    function displayError(message) {
        newsContainer.innerHTML = `<p class="no-results error-message">${message}</p>`;
        setStatus(message, true);
    }

     // Function to display no results message (No changes needed)
     function displayNoResults() {
        newsContainer.innerHTML = `<p class="no-results">No articles found matching your criteria.</p>`;
        setStatus('No articles found.');
    }

    // Function to update the status message (No changes needed)
    function setStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.classList.toggle('error', isError);
    }

    // --- Event Handler Trigger ---
    function fetchNewsBasedOnFilters() {
        const url = buildApiUrl(); // Build URL based on current filters/search
        fetchNews(url);
    }


    // --- Initial Load ---
    fetchNewsBasedOnFilters(); // Fetch news based on default filters when page loads

}); // End DOMContentLoaded